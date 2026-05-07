import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { CloudflareR2StorageProvider } from './providers/cloudflare-r2-storage.provider';
import { OracleS3StorageProvider } from './providers/oracle-s3-storage.provider';
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
    CloudflareR2StorageProvider,
    OracleS3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [
        ConfigService,
        LocalStorageProvider,
        S3StorageProvider,
        CloudflareR2StorageProvider,
        OracleS3StorageProvider,
      ],
      useFactory: (
        configService: ConfigService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
        r2: CloudflareR2StorageProvider,
        oracle: OracleS3StorageProvider,
      ): IStorageProvider => {
        const type = configService.get<string>('video.storage.provider', StorageProviderType.LOCAL);
        switch (type) {
          case StorageProviderType.S3:
            return s3;
          case StorageProviderType.CLOUDFLARE_R2:
            return r2;
          case StorageProviderType.ORACLE_S3:
            return oracle;
          default:
            return local;
        }
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
