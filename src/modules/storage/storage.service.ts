import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  IStorageProvider,
  IStoredFile,
  IUploadOptions,
  STORAGE_PROVIDER,
} from '../../domain/interfaces/storage-provider.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: IStorageProvider,
  ) {}

  async upload(options: IUploadOptions): Promise<IStoredFile> {
    this.logger.log(
      `Uploading file: ${options.sourcePath} → ${options.key} (provider: ${this.provider.getProviderName()})`,
    );
    return this.provider.upload(options);
  }

  async download(key: string, destinationPath: string): Promise<void> {
    this.logger.log(`Downloading: ${key} → ${destinationPath}`);
    return this.provider.download(key, destinationPath);
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`Deleting: ${key}`);
    return this.provider.delete(key);
  }

  async getUrl(key: string, expiresInSeconds?: number): Promise<string> {
    return this.provider.getUrl(key, expiresInSeconds);
  }

  getActiveProvider(): string {
    return this.provider.getProviderName();
  }
}
