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
 * Cloudflare R2 storage provider.
 *
 * R2 exposes an S3-compatible API at:
 *   https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com
 *
 * Required env vars:
 *   CF_ACCOUNT_ID            — Cloudflare account ID
 *   CF_R2_ACCESS_KEY_ID      — R2 API token (access key)
 *   CF_R2_SECRET_ACCESS_KEY  — R2 API token (secret key)
 *   CF_R2_BUCKET             — bucket name
 *   CF_R2_PUBLIC_URL         — optional custom domain / public bucket URL
 *                              (e.g. https://assets.example.com)
 */
@Injectable()
export class CloudflareR2StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(CloudflareR2StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('CF_ACCOUNT_ID', '');
    this.bucket = this.configService.get<string>('CF_R2_BUCKET', '');
    this.publicUrl = this.configService.get<string>('CF_R2_PUBLIC_URL', '');

    this.client = new S3Client({
      region: 'auto', // R2 uses the special "auto" region
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get<string>('CF_R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('CF_R2_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async upload(options: IUploadOptions): Promise<IStoredFile> {
    const body = createReadStream(options.sourcePath);
    const stat = await fs.stat(options.sourcePath);
    const contentType = options.contentType ?? 'application/octet-stream';

    // R2 does not support ACL — public access is configured at the bucket level
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

    this.logger.debug(`Uploaded to R2: r2://${this.bucket}/${options.key}`);

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
      throw new Error(`R2 object ${key} returned empty body`);
    }

    await fs.mkdir(dirname(destinationPath), { recursive: true });
    await pipeline(response.Body as Readable, createWriteStream(destinationPath));
    this.logger.debug(`Downloaded from R2: ${key} → ${destinationPath}`);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.debug(`Deleted from R2: r2://${this.bucket}/${key}`);
  }

  async getUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  getProviderName(): string {
    return 'cloudflare_r2';
  }
}
