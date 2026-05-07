import { Injectable, Logger } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import { RenderingService } from '../rendering/rendering.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import { IRenderedVideo } from '../../domain/interfaces/rendering.interface';
import { VideoAspectRatio, VideoResolution } from '../../domain/interfaces/rendering.interface';
import { ITTSVoice } from '../../domain/interfaces/tts-provider.interface';
import { VideoJobRepository } from '../database/repositories/video-job.repository';
import { CostRecordRepository } from '../database/repositories/cost-record.repository';
import { VideoPlatform } from '../../domain/enums/video.enums';

export interface IVideoGenerationResult {
  video: IRenderedVideo;
  title: string;
  description: string;
  totalScenes: number;
  scriptProvider: string;
  imageProvider: string;
  audioProvider: string;
  generatedAt: Date;
}

export interface IMongoDetailsResponse {
  videoJobs: Array<{
    jobId: string;
    topic: string;
    platform: string;
    status: string;
    progress: number;
    createdAt: Date;
    updatedAt: Date;
    finishedAt?: Date;
    error?: string;
  }>;
  costRecords: Array<{
    recordId: string;
    provider: string;
    contentType: string;
    estimatedCostUsd: number;
    durationMs: number;
    success: boolean;
    timestamp: Date;
  }>;
  totals: {
    videoJobs: number;
    costRecords: number;
  };
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly renderingService: RenderingService,
    private readonly videoJobRepository: VideoJobRepository,
    private readonly costRecordRepository: CostRecordRepository,
  ) {}

  async generateVideo(request: GenerateVideoRequestDto): Promise<IVideoGenerationResult> {
    const resolution = request.resolution ?? VideoResolution.HD_720P;
    const aspectRatio =
      request.aspectRatio ??
      (request.platform === VideoPlatform.INSTAGRAM_REELS
        ? VideoAspectRatio.PORTRAIT_9_16
        : VideoAspectRatio.LANDSCAPE_16_9);

    this.logger.log(
      `Video generation started — topic: "${request.topic}", platform: ${request.platform}`,
    );

    // Step 1: Generate script + all AI content (images & audio per scene)
    const content = await this.contentService.generateVideoContent(
      request,
      request.voice,
      aspectRatio,
    );

    this.logger.log(
      `Content ready — script: "${content.script.title}", ${content.sceneAssets.length} scenes generated`,
    );

    // Step 2: Render frames and assemble final video
    const video = await this.renderingService.renderVideo({
      script: content.script,
      sceneAssets: content.sceneAssets,
      resolution,
      aspectRatio,
      fps: request.fps,
    });

    this.logger.log(`Video generation complete — ${video.videoPath}`);

    return {
      video,
      title: content.script.title,
      description: content.script.description,
      totalScenes: content.script.scenes.length,
      scriptProvider: content.scriptProvider,
      imageProvider: content.imageProvider,
      audioProvider: content.audioProvider,
      generatedAt: content.generatedAt,
    };
  }

  getActiveProviders(): { script: string; image: string; tts: string } {
    return this.contentService.getActiveProviders();
  }

  getTtsVoices(): Promise<ITTSVoice[]> {
    return this.contentService.getTtsVoices();
  }

  async getMongoDetails(jobLimit = 50, costLimit = 100): Promise<IMongoDetailsResponse> {
    const normalizedJobLimit = Number.isFinite(jobLimit) ? jobLimit : 50;
    const normalizedCostLimit = Number.isFinite(costLimit) ? costLimit : 100;
    const safeJobLimit = Math.min(500, Math.max(1, Math.floor(normalizedJobLimit)));
    const safeCostLimit = Math.min(1000, Math.max(1, Math.floor(normalizedCostLimit)));

    const [jobs, costs] = await Promise.all([
      this.videoJobRepository.findAll(safeJobLimit, 0),
      this.costRecordRepository.findRecent(safeCostLimit, 0),
    ]);

    return {
      videoJobs: jobs.map((job) => ({
        jobId: job.jobId,
        topic: job.topic,
        platform: job.platform,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        finishedAt: job.finishedAt,
        error: job.error,
      })),
      costRecords: costs.map((record) => ({
        recordId: record.recordId,
        provider: record.provider,
        contentType: record.contentType,
        estimatedCostUsd: record.estimatedCostUsd,
        durationMs: record.durationMs,
        success: record.success,
        timestamp: record.timestamp,
      })),
      totals: {
        videoJobs: jobs.length,
        costRecords: costs.length,
      },
    };
  }
}
