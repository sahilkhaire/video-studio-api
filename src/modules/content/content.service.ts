import { Injectable, Logger, Inject } from '@nestjs/common';
import { IScriptGenerator, IVideoScript } from '../../domain/interfaces/script-generator.interface';
import {
  IImageGenerator,
  IGeneratedImage,
} from '../../domain/interfaces/image-generator.interface';
import { ITTSProvider, IGeneratedAudio } from '../../domain/interfaces/tts-provider.interface';
import { GenerateScriptRequestDto } from '../../domain/dto/generate-script.dto';
import { GenerateImageRequestDto } from '../../domain/dto/generate-image.dto';
import { GenerateAudioRequestDto } from '../../domain/dto/generate-audio.dto';
import { SCRIPT_GENERATOR, IMAGE_GENERATOR, TTS_PROVIDER } from './constants/injection-tokens';

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
  ) {}

  async generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript> {
    return this.scriptGenerator.generateScript(request);
  }

  async generateImage(request: GenerateImageRequestDto): Promise<IGeneratedImage> {
    return this.imageGenerator.generateImage(request);
  }

  async generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio> {
    return this.ttsProvider.generateAudio(request);
  }

  /**
   * Orchestrates full content generation: script → images → audio for all scenes.
   * Scenes are processed in parallel. Failures on individual scenes are captured
   * and flagged rather than failing the entire job.
   */
  async generateVideoContent(request: GenerateScriptRequestDto): Promise<IGeneratedContent> {
    this.logger.log(`Starting video content generation for: "${request.topic}"`);

    const script = await this.scriptGenerator.generateScript(request);
    this.logger.log(`Script generated: "${script.title}" with ${script.scenes.length} scenes`);

    const sceneAssets = await Promise.all(
      script.scenes.map((scene) =>
        this.generateSceneAssets(
          scene.id,
          scene.sequenceNumber,
          scene.imageDescription,
          scene.narration,
        ),
      ),
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
  ): Promise<ISceneAssets> {
    const [imageResult, audioResult] = await Promise.allSettled([
      this.imageGenerator.generateImage({ prompt: imageDescription }),
      this.ttsProvider.generateAudio({ text: narration }),
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

  getActiveProviders(): { script: string; image: string; tts: string } {
    return {
      script: this.scriptGenerator.getProviderName(),
      image: this.imageGenerator.getProviderName(),
      tts: this.ttsProvider.getProviderName(),
    };
  }
}
