import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { VideoService } from '../video/video.service';
import { VIDEO_QUEUE_NAME } from './constants/queue.constants';
import { IVideoJobData, IVideoJobResult } from '../../domain/interfaces/video-job.interface';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';

@Injectable()
export class VideoProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoProcessor.name);
  private worker: Worker<IVideoJobData, IVideoJobResult> | null = null;

  constructor(
    private readonly videoService: VideoService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    this.worker = new Worker<IVideoJobData, IVideoJobResult>(
      VIDEO_QUEUE_NAME,
      async (job: Job<IVideoJobData, IVideoJobResult>) => this.process(job),
      {
        connection: { host: redisHost, port: redisPort },
        concurrency: 2,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed — "${job.data.topic}"`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed — ${error.message}`, error.stack);
    });

    this.logger.log(`VideoProcessor worker started (concurrency: 2)`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('VideoProcessor worker closed');
    }
  }

  async process(job: Job<IVideoJobData, IVideoJobResult>): Promise<IVideoJobResult> {
    this.logger.log(`Processing job ${job.id} — topic: "${job.data.topic}"`);

    await job.updateProgress(5);

    const request: GenerateVideoRequestDto = {
      topic: job.data.topic,
      platform: job.data.platform,
      style: job.data.style,
      targetDuration: job.data.targetDuration,
      targetAudience: job.data.targetAudience,
      additionalContext: job.data.additionalContext,
      resolution: job.data.resolution,
      fps: job.data.fps,
    };

    await job.updateProgress(10);

    const generationResult = await this.videoService.generateVideo(request);

    await job.updateProgress(100);

    const result: IVideoJobResult = {
      videoPath: generationResult.video.videoPath,
      title: generationResult.title,
      description: generationResult.description,
      totalScenes: generationResult.totalScenes,
      duration: generationResult.video.duration,
      width: generationResult.video.width,
      height: generationResult.video.height,
      fps: generationResult.video.fps,
      fileSize: generationResult.video.fileSize,
      scriptProvider: generationResult.scriptProvider,
      imageProvider: generationResult.imageProvider,
      audioProvider: generationResult.audioProvider,
      generatedAt: generationResult.generatedAt,
    };

    return result;
  }
}
