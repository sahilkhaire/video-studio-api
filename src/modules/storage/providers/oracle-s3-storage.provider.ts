import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import {
  IStorageProvider,
  IStoredFile,
  IUploadOptions,
} from '../../../domain/interfaces/storage-provider.interface';

/**
 * Oracle Cloud Object Storage provider using the S3-compatible API.
 *
 * Endpoint format:
 *   https://<OCI_NAMESPACE>.compat.objectstorage.<OCI_REGION>.oraclecloud.com
 *
 * Required env vars:
 *   OCI_NAMESPACE        — Object Storage namespace (tenancy name)
 *   OCI_REGION           — e.g. us-ashburn-1
 *   OCI_S3_ACCESS_KEY    — Customer Secret Key (access key)
 *   OCI_S3_SECRET_KEY    — Customer Secret Key (secret)
 *   OCI_S3_BUCKET        — bucket name
 *   OCI_S3_PUBLIC_URL    — optional CDN / pre-authenticated request base URL
 */
@Injectable()
export class OracleS3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(OracleS3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly namespace: string;
  private readonly region: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.namespace = this.configService.get<string>('OCI_NAMESPACE', '');
    this.region = this.configService.get<string>('OCI_REGION', 'us-ashburn-1');
    this.bucket = this.configService.get<string>('OCI_S3_BUCKET', '');
    this.publicUrl = this.configService.get<string>('OCI_S3_PUBLIC_URL', '');

    this.client = new S3Client({
      region: this.region,
      endpoint: `https://${this.namespace}.compat.objectstorage.${this.region}.oraclecloud.com`,
      // Oracle S3-compat requires path-style addressing
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('OCI_S3_ACCESS_KEY', ''),
        secretAccessKey: this.configService.get<string>('OCI_S3_SECRET_KEY', ''),
      },
    });
  }

  async upload(options: IUploadOptions): Promise<IStoredFile> {
    const body = createReadStream(options.sourcePath);
    const stat = await fs.stat(options.sourcePath);
    const contentType = options.contentType ?? 'application/octet-stream';

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const url =
      options.isPublic && this.publicUrl
        ? `${this.publicUrl.replace(/\/$/, '')}/${options.key}`
        : await this.getUrl(options.key);

    this.logger.debug(`Uploaded to Oracle S3: oci://${this.bucket}/${options.key}`);

    return {
      key: options.key,
      url,
      fileSize: stat.size,
      contentType,
      uploadedAt: new Date(),
    };
  }

  async download(key: string, destinationPath: string): Promise<void> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new Error(`Oracle S3 object ${key} returned empty body`);
    }

    await fs.mkdir(dirname(destinationPath), { recursive: true });
    await pipeline(response.Body as Readable, createWriteStream(destinationPath));
    this.logger.debug(`Downloaded from Oracle S3: ${key} → ${destinationPath}`);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.debug(`Deleted from Oracle S3: oci://${this.bucket}/${key}`);
  }

  async getUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  getProviderName(): string {
    return 'oracle_s3';
  }
}
