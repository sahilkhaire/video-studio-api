import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { IScriptGenerator, IVideoScript } from '../../domain/interfaces/script-generator.interface';
import {
  IImageGenerator,
  IGeneratedImage,
} from '../../domain/interfaces/image-generator.interface';
import {
  ITTSProvider,
  ITTSVoice,
  IGeneratedAudio,
} from '../../domain/interfaces/tts-provider.interface';
import { GenerateScriptRequestDto } from '../../domain/dto/generate-script.dto';
import { GenerateImageRequestDto } from '../../domain/dto/generate-image.dto';
import { GenerateAudioRequestDto } from '../../domain/dto/generate-audio.dto';
import { ImageSize } from '../../domain/enums/video.enums';
import { VideoAspectRatio } from '../../domain/interfaces/rendering.interface';
import { SCRIPT_GENERATOR, IMAGE_GENERATOR, TTS_PROVIDER } from './constants/injection-tokens';
import { CostTrackingService } from '../cost/cost-tracking.service';
import { ContentType } from '../../domain/interfaces/cost-tracking.interface';
import { CacheKeyService } from '../cache/cache-key.service';
import { ContentCacheService } from '../cache/content-cache.service';

export interface ISceneAssets {
  sceneId: string;
  sequenceNumber: number;
  image?: IGeneratedImage;
  audio?: IGeneratedAudio;
  imageFailed?: boolean;
  audioFailed?: boolean;
}

export interface IGeneratedContent {
  script: IVideoScript;
  sceneAssets: ISceneAssets[];
  scriptProvider: string;
  imageProvider: string;
  audioProvider: string;
  generatedAt: Date;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @Inject(SCRIPT_GENERATOR) private readonly scriptGenerator: IScriptGenerator,
    @Inject(IMAGE_GENERATOR) private readonly imageGenerator: IImageGenerator,
    @Inject(TTS_PROVIDER) private readonly ttsProvider: ITTSProvider,
    private readonly configService: ConfigService,
    private readonly costTrackingService: CostTrackingService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly contentCacheService: ContentCacheService,
  ) {}

  private lookupCostRate(contentType: ContentType, providerName: string): number {
    const key = `providers.costs.${contentType}.${providerName}`;
    return this.configService.get<number>(key, 0);
  }

  async generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript> {
    const cacheKey = this.cacheKeyService.forScript(request);
    const cached = await this.contentCacheService.get<IVideoScript>(cacheKey);
    if (cached) {
      this.logger.debug(`Script cache hit: ${cacheKey}`);
      return cached;
    }

    const start = Date.now();
    const providerName = this.scriptGenerator.getProviderName();
    try {
      const result = await this.scriptGenerator.generateScript(request);
      this.costTrackingService.recordCall({
        provider: providerName,
        contentType: ContentType.SCRIPT,
        estimatedCostUsd: this.lookupCostRate(ContentType.SCRIPT, providerName),
        durationMs: Date.now() - start,
        success: true,
        timestamp: new Date(),
      });
      const ttl = this.configService.get<number>('video.cache.ttlScripts', 2592000);
      await this.contentCacheService.set(cacheKey, result, ttl);
      return result;
    } catch (error) {
      this.costTrackingService.recordCall({
        provider: providerName,
        contentType: ContentType.SCRIPT,
        estimatedCostUsd: 0,
        durationMs: Date.now() - start,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async generateImage(request: GenerateImageRequestDto): Promise<IGeneratedImage> {
    const cacheKey = this.cacheKeyService.forImage(request);
    const cached = await this.contentCacheService.get<IGeneratedImage>(cacheKey);
    if (cached) {
      this.logger.debug(`Image cache hit: ${cacheKey}`);
      return cached;
    }

    const start = Date.now();
    const providerName = this.imageGenerator.getProviderName();
    try {
      const result = await this.imageGenerator.generateImage(request);
      this.costTrackingService.recordCall({
        provider: providerName,
        contentType: ContentType.IMAGE,
        estimatedCostUsd: this.lookupCostRate(ContentType.IMAGE, providerName),
        durationMs: Date.now() - start,
        success: true,
        timestamp: new Date(),
      });
      const ttl = this.configService.get<number>('video.cache.ttlImages', 604800);
      await this.contentCacheService.set(cacheKey, result, ttl);
      return result;
    } catch (error) {
      this.costTrackingService.recordCall({
        provider: providerName,
        contentType: ContentType.IMAGE,
        estimatedCostUsd: 0,
        durationMs: Date.now() - start,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio> {
    const cacheKey = this.cacheKeyService.forAudio(request);
    const cached = await this.contentCacheService.get<IGeneratedAudio>(cacheKey);
    if (cached) {
      if (await this.fileExists(cached.filePath)) {
        this.logger.debug(`Audio cache hit: ${cacheKey}`);
        return cached;
      }

      this.logger.warn(
        `Audio cache stale (file missing), evicting key ${cacheKey}: ${cached.filePath}`,
      );
      await this.contentCacheService.del(cacheKey);
    }

    const start = Date.now();
    const providerName = this.ttsProvider.getProviderName();
    try {
      const result = await this.ttsProvider.generateAudio(request);
      this.costTrackingService.recordCall({
        provider: providerName,
        contentType: ContentType.AUDIO,
        estimatedCostUsd: this.lookupCostRate(ContentType.AUDIO, providerName),
        durationMs: Date.now() - start,
        success: true,
        timestamp: new Date(),
      });
      const ttl = this.configService.get<number>('video.cache.ttlAudio', 604800);
      await this.contentCacheService.set(cacheKey, result, ttl);
      return result;
    } catch (error) {
      this.costTrackingService.recordCall({
        provider: providerName,
        contentType: ContentType.AUDIO,
        estimatedCostUsd: 0,
        durationMs: Date.now() - start,
        success: false,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Orchestrates full content generation: script → images → audio for all scenes.
   * Scenes are processed in parallel. Failures on individual scenes are captured
   * and flagged rather than failing the entire job.
   */
  async generateVideoContent(
    request: GenerateScriptRequestDto,
    voice?: string,
    aspectRatio: VideoAspectRatio = VideoAspectRatio.LANDSCAPE_16_9,
  ): Promise<IGeneratedContent> {
    this.logger.log(`Starting video content generation for: "${request.topic}"`);

    const script = await this.generateScript(request);
    this.logger.log(`Script generated: "${script.title}" with ${script.scenes.length} scenes`);

    const maxConcurrentScenes = Math.max(
      1,
      this.configService.get<number>('video.queue.concurrency', 2),
    );
    this.logger.log(`Generating scene assets with concurrency ${maxConcurrentScenes}`);

    const imageSize = this.getImageSizeForAspectRatio(aspectRatio);
    const sceneAssets = await this.generateSceneAssetsWithConcurrency(
      script,
      maxConcurrentScenes,
      voice,
      imageSize,
    );

    this.logger.log(`Content generation complete for: "${script.title}"`);

    return {
      script,
      sceneAssets,
      scriptProvider: this.scriptGenerator.getProviderName(),
      imageProvider: this.imageGenerator.getProviderName(),
      audioProvider: this.ttsProvider.getProviderName(),
      generatedAt: new Date(),
    };
  }

  private async generateSceneAssets(
    sceneId: string,
    sequenceNumber: number,
    imageDescription: string,
    narration: string,
    voice?: string,
    imageSize?: ImageSize,
  ): Promise<ISceneAssets> {
    const [imageResult, audioResult] = await Promise.allSettled([
      this.generateImage({ prompt: imageDescription, size: imageSize }),
      this.generateAudio({ text: narration, voice }),
    ]);

    const sceneAsset: ISceneAssets = { sceneId, sequenceNumber };

    if (imageResult.status === 'fulfilled') {
      sceneAsset.image = imageResult.value;
    } else {
      this.logger.warn(
        `Image generation failed for scene ${sequenceNumber}: ${imageResult.reason}`,
      );
      sceneAsset.imageFailed = true;
    }

    if (audioResult.status === 'fulfilled') {
      sceneAsset.audio = audioResult.value;
    } else {
      this.logger.warn(
        `Audio generation failed for scene ${sequenceNumber}: ${audioResult.reason}`,
      );
      sceneAsset.audioFailed = true;
    }

    return sceneAsset;
  }

  private async generateSceneAssetsWithConcurrency(
    script: IVideoScript,
    maxConcurrentScenes: number,
    voice?: string,
    imageSize?: ImageSize,
  ): Promise<ISceneAssets[]> {
    const results: ISceneAssets[] = new Array(script.scenes.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = cursor;
        cursor += 1;

        if (index >= script.scenes.length) {
          return;
        }

        const scene = script.scenes[index];
        results[index] = await this.generateSceneAssets(
          scene.id,
          scene.sequenceNumber,
          scene.imageDescription,
          scene.narration,
          voice,
          imageSize,
        );
      }
    };

    const workers = Array.from(
      { length: Math.min(maxConcurrentScenes, script.scenes.length) },
      () => worker(),
    );

    await Promise.all(workers);
    return results;
  }

  getActiveProviders(): { script: string; image: string; tts: string } {
    return {
      script: this.scriptGenerator.getProviderName(),
      image: this.imageGenerator.getProviderName(),
      tts: this.ttsProvider.getProviderName(),
    };
  }

  getTtsVoices(): Promise<ITTSVoice[]> {
    return this.ttsProvider.getVoices();
  }

  private async fileExists(filePath: string | undefined): Promise<boolean> {
    if (!filePath) return false;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getImageSizeForAspectRatio(aspectRatio: VideoAspectRatio): ImageSize {
    switch (aspectRatio) {
      case VideoAspectRatio.PORTRAIT_9_16:
        return ImageSize.PORTRAIT;
      case VideoAspectRatio.LANDSCAPE_16_9:
        return ImageSize.LANDSCAPE;
      case VideoAspectRatio.SQUARE_1_1:
      default:
        return ImageSize.SQUARE;
    }
  }
}
