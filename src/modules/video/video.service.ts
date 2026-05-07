import { Injectable, Logger } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import { RenderingService } from '../rendering/rendering.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import { IRenderedVideo } from '../../domain/interfaces/rendering.interface';
import { VideoResolution } from '../../domain/interfaces/rendering.interface';

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

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly contentService: ContentService,
    private readonly renderingService: RenderingService,
  ) {}

  async generateVideo(request: GenerateVideoRequestDto): Promise<IVideoGenerationResult> {
    const resolution = request.resolution ?? VideoResolution.HD_720P;

    this.logger.log(
      `Video generation started — topic: "${request.topic}", platform: ${request.platform}`,
    );

    // Step 1: Generate script + all AI content (images & audio per scene)
    const content = await this.contentService.generateVideoContent(request);

    this.logger.log(
      `Content ready — script: "${content.script.title}", ${content.sceneAssets.length} scenes generated`,
    );

    // Step 2: Render frames and assemble final video
    const video = await this.renderingService.renderVideo({
      script: content.script,
      sceneAssets: content.sceneAssets,
      resolution,
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
}
