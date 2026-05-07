import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { VideoJob, VideoJobSchema } from './schemas/video-job.schema';
import { CostRecord, CostRecordSchema } from './schemas/cost-record.schema';
import { VideoJobRepository } from './repositories/video-job.repository';
import { CostRecordRepository } from './repositories/cost-record.repository';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/video_generation'),
      }),
    }),
    MongooseModule.forFeature([
      { name: VideoJob.name, schema: VideoJobSchema },
      { name: CostRecord.name, schema: CostRecordSchema },
    ]),
  ],
  providers: [VideoJobRepository, CostRecordRepository],
  exports: [VideoJobRepository, CostRecordRepository],
})
export class DatabaseModule {}
