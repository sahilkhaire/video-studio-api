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

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
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
        ACL: options.isPublic ? 'public-read' : 'private',
      }),
    );

    const url = options.isPublic
      ? `https://${this.bucket}.s3.${this.region}.amazonaws.com/${options.key}`
      : await this.getUrl(options.key);

    this.logger.debug(`Uploaded to S3: s3://${this.bucket}/${options.key}`);

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
      throw new Error(`S3 object ${key} returned empty body`);
    }

    await fs.mkdir(dirname(destinationPath), { recursive: true });
    await pipeline(response.Body as Readable, createWriteStream(destinationPath));
    this.logger.debug(`Downloaded from S3: ${key} → ${destinationPath}`);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.debug(`Deleted from S3: s3://${this.bucket}/${key}`);
  }

  async getUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  getProviderName(): string {
    return 's3';
  }
}
