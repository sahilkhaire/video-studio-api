import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import videoConfig from './config/video.config';
import providersConfig from './config/providers.config';
import { ContentModule } from './modules/content/content.module';
import { VideoModule } from './modules/video/video.module';
import { QueueModule } from './modules/queue/queue.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { CostModule } from './modules/cost/cost.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { DatabaseModule } from './modules/database/database.module';
import { PlaygroundModule } from './modules/playground/playground.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, videoConfig, providersConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL_MS', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 60),
          },
        ],
      }),
    }),
    ContentModule,
    VideoModule,
    QueueModule,
    StorageModule,
    HealthModule,
    CostModule,
    DatabaseModule,
    PlaygroundModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global API key guard — skipped when API_KEY env var is not set
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    // Global rate limiter — 60 req/min by default, skipped for @Public() routes
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
