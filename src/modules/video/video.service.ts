import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import ffmpeg = require('fluent-ffmpeg');
import { v4 as uuidv4 } from 'uuid';
import { ContentService } from '../content/content.service';
import { RenderingService } from '../rendering/rendering.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import { GenerateContentImagesVideoRequestDto } from '../../domain/dto/generate-content-images-video.dto';
import { IRenderedVideo } from '../../domain/interfaces/rendering.interface';
import { VideoAspectRatio, VideoResolution } from '../../domain/interfaces/rendering.interface';
import { resolveVideoResolutionSpec } from '../../domain/interfaces/rendering.interface';
import { ITTSVoice } from '../../domain/interfaces/tts-provider.interface';
import { VideoJobRepository } from '../database/repositories/video-job.repository';
import { CostRecordRepository } from '../database/repositories/cost-record.repository';
import {
  AudioFormat,
  ImageFormat,
  ImageSize,
  SceneTransition,
  VideoPlatform,
  VideoStyle,
} from '../../domain/enums/video.enums';
import {
  IMusicVideoJobData,
  IMusicVideoJobResult,
  IMusicVideoVariantResult,
  VideoJobType,
} from '../../domain/interfaces/video-job.interface';
import { ISceneAssets } from '../content/content.service';
import { IVideoScript } from '../../domain/interfaces/script-generator.interface';
import { EdgeTTSProvider } from '../content/providers/tts/edge-tts.provider';

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
    private readonly configService: ConfigService,
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
      showCaptions: request.showCaptions,
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

  async generateVideoFromContentImages(
    request: GenerateContentImagesVideoRequestDto,
  ): Promise<IVideoGenerationResult> {
    const resolution = request.resolution ?? VideoResolution.HD_720P;
    const aspectRatio = request.aspectRatio ?? VideoAspectRatio.LANDSCAPE_16_9;
    const fps = request.fps ?? 30;
    const style = request.style ?? VideoStyle.CINEMATIC;
    const resolutionSpec = resolveVideoResolutionSpec(resolution, aspectRatio);

    this.logger.log(
      `Content-image video generation started — segments: ${request.data.length}, resolution: ${resolution}, aspectRatio: ${aspectRatio}`,
    );

    const edgeTtsProvider = new EdgeTTSProvider(this.configService);
    const generatedAudio = await Promise.all(
      request.data.map((segment) =>
        edgeTtsProvider.generateAudio({
          text: segment.content,
          voice: request.voice,
        }),
      ),
    );
    const segmentAudio = await Promise.all(
      generatedAudio.map(async (audio) => {
        const actualDuration = await this.getAudioDurationSeconds(audio.filePath).catch(() => 0);
        return {
          ...audio,
          duration: Math.max(1, actualDuration || audio.duration || 1),
        };
      }),
    );

    const scenes: IVideoScript['scenes'] = [];
    const sceneAssets: ISceneAssets[] = [];
    let sequenceNumber = 1;

    for (let segmentIndex = 0; segmentIndex < request.data.length; segmentIndex += 1) {
      const segment = request.data[segmentIndex];
      const audio = segmentAudio[segmentIndex];
      const segmentDuration = Math.max(1, audio.duration || 1);
      const perImageDuration = Math.max(0.8, segmentDuration / segment.images.length);

      for (let imageIndex = 0; imageIndex < segment.images.length; imageIndex += 1) {
        const imageUrl = segment.images[imageIndex];
        const sceneId = `segment-${segmentIndex + 1}-image-${imageIndex + 1}-${uuidv4()}`;

        scenes.push({
          id: sceneId,
          sequenceNumber,
          narration: segment.content,
          imageDescription: 'User provided image URL',
          duration: perImageDuration,
          transition: SceneTransition.FADE,
        });

        sceneAssets.push({
          sceneId,
          sequenceNumber,
          image: {
            url: imageUrl,
            width: resolutionSpec.width,
            height: resolutionSpec.height,
            format: this.resolveImageFormat(imageUrl),
            prompt: 'User provided image URL',
          },
          ...(imageIndex === 0
            ? {
                audio: {
                  filePath: audio.filePath,
                  duration: segmentDuration,
                  format: audio.format ?? AudioFormat.MP3,
                  sampleRate: audio.sampleRate,
                  text: segment.content,
                },
              }
            : {}),
        });

        sequenceNumber += 1;
      }
    }

    const totalDuration = scenes.reduce((acc, scene) => acc + scene.duration, 0);
    const generatedAt = new Date();
    const script: IVideoScript = {
      title: 'Content and Images Video',
      description: `Generated from ${request.data.length} user-provided content segments and image lists.`,
      platform: VideoPlatform.YOUTUBE,
      style,
      scenes,
      totalDuration,
      generatedAt,
    };

    try {
      const video = await this.renderingService.renderVideo({
        script,
        sceneAssets,
        resolution,
        aspectRatio,
        fps,
        showCaptions: request.showCaptions ?? request.showCaption,
        transitionsEnabled: false,
      });

      this.logger.log(`Content-image video generation complete — ${video.videoPath}`);

      return {
        video,
        title: script.title,
        description: script.description,
        totalScenes: scenes.length,
        scriptProvider: 'user-input',
        imageProvider: 'user-input',
        audioProvider: edgeTtsProvider.getProviderName(),
        generatedAt,
      };
    } finally {
      await this.cleanupFiles(generatedAudio.map((audio) => audio.filePath));
    }
  }

  getActiveProviders(): { script: string; image: string; tts: string } {
    return this.contentService.getActiveProviders();
  }

  getTtsVoices(): Promise<ITTSVoice[]> {
    return this.contentService.getTtsVoices();
  }

  async notifyCallback(callbackUrl: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(
          `Callback failed (${response.status}) for ${callbackUrl} — payload: ${JSON.stringify(payload)}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Callback request failed for ${callbackUrl}: ${error}`);
    }
  }

  async generateMusicVisualStory(request: IMusicVideoJobData): Promise<IMusicVideoJobResult> {
    const musicSource = await this.resolveMusicSource(request);
    const musicPath = musicSource.path;
    const musicDuration = await this.getAudioDurationSeconds(musicPath);
    const targetDuration = Math.max(15, Math.round(musicDuration));

    const scriptRequest = {
      topic: request.topic,
      platform: VideoPlatform.YOUTUBE,
      style: request.style ?? VideoStyle.CARTOON,
      targetDuration,
      additionalContext: this.buildMusicAdditionalContext(request),
    };

    const script = await this.contentService.generateScriptWithProvider(
      scriptRequest,
      request.scriptProvider,
    );

    const sceneAssets = await this.generateVisualSceneAssets(
      script,
      request.imageProvider,
      request.imageModel,
    );

    const fps = request.fps ?? 30;
    const youtubeResolution = request.youtubeResolution ?? VideoResolution.FULL_HD_1080P;
    const reelsResolution = request.reelsResolution ?? VideoResolution.FULL_HD_1080P;

    try {
      const [youtubeVideo, reelsVideo] = await Promise.all([
        this.renderingService.renderVideo({
          script,
          sceneAssets,
          resolution: youtubeResolution,
          aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
          fps,
          showCaptions: false,
          backgroundAudioPath: musicPath,
        }),
        this.renderingService.renderVideo({
          script,
          sceneAssets,
          resolution: reelsResolution,
          aspectRatio: VideoAspectRatio.PORTRAIT_9_16,
          fps,
          showCaptions: false,
          backgroundAudioPath: musicPath,
        }),
      ]);

      const variants: IMusicVideoVariantResult[] = [
        {
          platform: VideoPlatform.YOUTUBE,
          aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
          resolution: youtubeResolution,
          videoPath: youtubeVideo.videoPath,
          duration: youtubeVideo.duration,
          width: youtubeVideo.width,
          height: youtubeVideo.height,
          fps: youtubeVideo.fps,
          fileSize: youtubeVideo.fileSize,
        },
        {
          platform: VideoPlatform.INSTAGRAM_REELS,
          aspectRatio: VideoAspectRatio.PORTRAIT_9_16,
          resolution: reelsResolution,
          videoPath: reelsVideo.videoPath,
          duration: reelsVideo.duration,
          width: reelsVideo.width,
          height: reelsVideo.height,
          fps: reelsVideo.fps,
          fileSize: reelsVideo.fileSize,
        },
      ];

      this.assertQualityGate(variants);

      return {
        mode: VideoJobType.MUSIC_VISUAL_STORY,
        title: script.title,
        description: script.description,
        totalScenes: script.scenes.length,
        variants,
        scriptProvider: request.scriptProvider ?? this.contentService.getActiveProviders().script,
        imageProvider: request.imageProvider ?? this.contentService.getActiveProviders().image,
        generatedAt: new Date(),
      };
    } finally {
      if (musicSource.shouldCleanup) {
        await this.cleanupFiles([musicPath]);
      }
    }
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

  private async generateVisualSceneAssets(
    script: {
      scenes: Array<{
        id: string;
        sequenceNumber: number;
        imageDescription: string;
      }>;
    },
    imageProvider?: IMusicVideoJobData['imageProvider'],
    imageModel?: string,
  ): Promise<ISceneAssets[]> {
    const sceneConcurrency = Math.max(
      1,
      this.configService.get<number>('video.queue.concurrency', 2),
    );
    const results: ISceneAssets[] = new Array(script.scenes.length);
    const imageSize = ImageSize.LANDSCAPE;
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= script.scenes.length) {
          return;
        }

        const scene = script.scenes[index];
        const sceneAsset: ISceneAssets = {
          sceneId: scene.id,
          sequenceNumber: scene.sequenceNumber,
        };

        try {
          sceneAsset.image = await this.contentService.generateImageWithProvider(
            {
              prompt: scene.imageDescription,
              size: imageSize,
              ...(imageModel ? { model: imageModel } : {}),
            },
            imageProvider,
          );
        } catch (error) {
          this.logger.warn(`Image generation failed for scene ${scene.sequenceNumber}: ${error}`);
          sceneAsset.imageFailed = true;
        }

        results[index] = sceneAsset;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(sceneConcurrency, script.scenes.length) }, () => worker()),
    );

    return results;
  }

  private async resolveMusicSource(
    request: IMusicVideoJobData,
  ): Promise<{ path: string; shouldCleanup: boolean }> {
    if (request.uploadedMusicPath) {
      return { path: resolve(request.uploadedMusicPath), shouldCleanup: true };
    }

    if (request.musicPath) {
      const localPath = resolve(request.musicPath);
      await fs.access(localPath);
      return { path: localPath, shouldCleanup: false };
    }

    if (request.musicUrl) {
      const tempDir = resolve(this.configService.get<string>('video.storage.tempPath', './temp'));
      await fs.mkdir(tempDir, { recursive: true });
      const extension = request.musicUrl.toLowerCase().includes('.wav') ? 'wav' : 'mp3';
      const outputPath = join(tempDir, `music-source-${uuidv4()}.${extension}`);
      await this.downloadToFile(request.musicUrl, outputPath);
      return { path: outputPath, shouldCleanup: true };
    }

    throw new Error('Music source is required');
  }

  private async downloadToFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download music from URL: ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  }

  private async getAudioDurationSeconds(filePath: string): Promise<number> {
    return new Promise<number>((resolvePromise, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }
        const duration = metadata.format?.duration ?? 0;
        resolvePromise(duration);
      });
    });
  }

  private buildMusicAdditionalContext(request: IMusicVideoJobData): string {
    const lines: string[] = [
      'Create visual-only story scenes. Do not include subtitles, lyric overlays, or narration.',
      'The song is the only audio track.',
      'Keep scenes cinematic and coherent for a cartoon storytelling style.',
      `Use transitions from: ${Object.values(SceneTransition).join(', ')}`,
    ];

    if (request.additionalContext) {
      lines.push(`User context: ${request.additionalContext}`);
    }
    if (request.lyrics) {
      lines.push(`Lyrics guidance: ${request.lyrics}`);
    }

    return lines.join('\n');
  }

  private assertQualityGate(variants: IMusicVideoVariantResult[]): void {
    for (const variant of variants) {
      if (variant.fileSize <= 0) {
        throw new Error(`Quality gate failed: empty output for ${variant.platform}`);
      }

      if (variant.platform === VideoPlatform.YOUTUBE) {
        if (variant.width < 1920 || variant.height < 1080) {
          throw new Error('Quality gate failed: YouTube output below 1080p baseline');
        }
      }

      if (variant.platform === VideoPlatform.INSTAGRAM_REELS) {
        if (variant.width < 1080 || variant.height < 1920) {
          throw new Error('Quality gate failed: Reels output below 1080x1920 baseline');
        }
      }
    }
  }

  private resolveImageFormat(imageUrl: string): ImageFormat {
    const normalizedUrl = imageUrl.toLowerCase().split('?')[0].split('#')[0];
    if (normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg')) {
      return ImageFormat.JPEG;
    }
    if (normalizedUrl.endsWith('.webp')) {
      return ImageFormat.WEBP;
    }
    return ImageFormat.PNG;
  }

  private async cleanupFiles(paths: Array<string | undefined>): Promise<void> {
    const safePaths = paths.filter((path): path is string => Boolean(path));
    await Promise.allSettled(safePaths.map((filePath) => fs.unlink(filePath)));
  }
}
