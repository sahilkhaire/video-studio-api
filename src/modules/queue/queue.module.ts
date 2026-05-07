import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { VideoModule } from '../video/video.module';
import { QueueService } from './queue.service';
import { VideoProcessor } from './video.processor';
import { VIDEO_QUEUE_NAME, VIDEO_QUEUE_TOKEN } from './constants/queue.constants';

@Module({
  imports: [ConfigModule, forwardRef(() => VideoModule)],
  providers: [
    {
      provide: VIDEO_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Queue => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        return new Queue(VIDEO_QUEUE_NAME, {
          connection: { host, port },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        });
      },
    },
    QueueService,
    VideoProcessor,
  ],
  exports: [QueueService],
})
export class QueueModule {}
