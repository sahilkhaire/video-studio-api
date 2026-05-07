import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheKeyService } from './cache-key.service';
import { ContentCacheService } from './content-cache.service';

@Module({
  imports: [ConfigModule],
  providers: [CacheKeyService, ContentCacheService],
  exports: [CacheKeyService, ContentCacheService],
})
export class CacheModule {}
