import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { StorageService } from './storage.service';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  StorageProviderType,
} from '../../domain/interfaces/storage-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
      useFactory: (
        configService: ConfigService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
      ): IStorageProvider => {
        const type = configService.get<string>('video.storage.provider', StorageProviderType.LOCAL);
        if (type === StorageProviderType.S3) {
          return s3;
        }
        return local;
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
