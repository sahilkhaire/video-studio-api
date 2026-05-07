import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, videoConfig, providersConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ContentModule,
    VideoModule,
    QueueModule,
    StorageModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
