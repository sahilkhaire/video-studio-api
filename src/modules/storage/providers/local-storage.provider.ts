import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import {
  IStorageProvider,
  IStoredFile,
  IUploadOptions,
} from '../../../domain/interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = this.configService.get<string>('video.storage.localPath', './storage');
  }

  async upload(options: IUploadOptions): Promise<IStoredFile> {
    const destPath = join(this.basePath, options.key);
    await fs.mkdir(dirname(destPath), { recursive: true });
    await pipeline(createReadStream(options.sourcePath), createWriteStream(destPath));

    const stat = await fs.stat(destPath);

    this.logger.debug(`Stored file locally: ${destPath}`);

    return {
      key: options.key,
      url: destPath,
      fileSize: stat.size,
      contentType: options.contentType ?? 'application/octet-stream',
      uploadedAt: new Date(),
    };
  }

  async download(key: string, destinationPath: string): Promise<void> {
    const sourcePath = join(this.basePath, key);
    await fs.mkdir(dirname(destinationPath), { recursive: true });
    await pipeline(createReadStream(sourcePath), createWriteStream(destinationPath));
    this.logger.debug(`Downloaded file from local storage: ${key} → ${destinationPath}`);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    await fs.unlink(filePath);
    this.logger.debug(`Deleted local file: ${filePath}`);
  }

  async getUrl(key: string): Promise<string> {
    return join(this.basePath, key);
  }

  getProviderName(): string {
    return 'local';
  }
}
