import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { VideoService } from '../video/video.service';
import { VIDEO_QUEUE_NAME } from './constants/queue.constants';
import { IVideoJobData, IVideoJobResult } from '../../domain/interfaces/video-job.interface';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import { VideoJobRepository } from '../database/repositories/video-job.repository';

@Injectable()
export class VideoProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoProcessor.name);
  private worker: Worker<IVideoJobData, IVideoJobResult> | null = null;

  constructor(
    private readonly videoService: VideoService,
    private readonly configService: ConfigService,
    private readonly videoJobRepository: VideoJobRepository,
  ) {}

  onModuleInit(): void {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const concurrency = Math.max(1, this.configService.get<number>('video.queue.concurrency', 2));
    const lockDurationMs = Math.max(
      30000,
      this.configService.get<number>('video.queue.lockDurationMs', 300000),
    );
    const stalledIntervalMs = Math.max(
      5000,
      this.configService.get<number>('video.queue.stalledIntervalMs', 30000),
    );
    const maxStalledCount = Math.max(
      1,
      this.configService.get<number>('video.queue.maxStalledCount', 3),
    );

    this.worker = new Worker<IVideoJobData, IVideoJobResult>(
      VIDEO_QUEUE_NAME,
      async (job: Job<IVideoJobData, IVideoJobResult>) => this.process(job),
      {
        connection: { host: redisHost, port: redisPort },
        concurrency,
        lockDuration: lockDurationMs,
        stalledInterval: stalledIntervalMs,
        maxStalledCount,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed — "${job.data.topic}"`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed — ${error.message}`, error.stack);
    });

    this.worker.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled and was re-queued by BullMQ`);
    });

    this.logger.log(
      `VideoProcessor worker started (concurrency: ${concurrency}, lockDurationMs: ${lockDurationMs}, stalledIntervalMs: ${stalledIntervalMs}, maxStalledCount: ${maxStalledCount})`,
    );
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
    await this.videoJobRepository.markActive(job.id ?? '');

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
    await this.videoJobRepository.updateProgress(job.id ?? '', 10);

    const generationResult = await this.videoService.generateVideo(request);

    await job.updateProgress(100);
    await this.videoJobRepository.updateProgress(job.id ?? '', 100);

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

    await this.videoJobRepository.markCompleted(job.id ?? '', result);
    return result;
  }
}
