import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FrameComposerService } from './frame-composer.service';
import { VideoAssemblerService } from './video-assembler.service';
import {
  IRenderVideoRequest,
  IRenderedVideo,
  IComposedFrame,
  VIDEO_RESOLUTION_MAP,
} from '../../domain/interfaces/rendering.interface';

@Injectable()
export class RenderingService {
  private readonly logger = new Logger(RenderingService.name);
  private readonly defaultFps: number;

  constructor(
    private readonly frameComposer: FrameComposerService,
    private readonly videoAssembler: VideoAssemblerService,
    private readonly configService: ConfigService,
  ) {
    this.defaultFps = this.configService.get<number>('video.fps', 30);
  }

  async renderVideo(request: IRenderVideoRequest): Promise<IRenderedVideo> {
    const { script, sceneAssets, resolution, outputPath } = request;
    const fps = request.fps ?? this.defaultFps;
    const resolutionSpec = VIDEO_RESOLUTION_MAP[resolution];

    this.logger.log(
      `Starting render: "${script.title}" — ${script.scenes.length} scenes, ${resolutionSpec.width}x${resolutionSpec.height} @ ${fps}fps`,
    );

    // Phase 1: Compose one frame image per scene (in parallel)
    const frames = await this.composeAllFrames(request, resolutionSpec, fps);

    // Phase 2: Build audio track map aligned with scene order
    const audioTracks = script.scenes.map((scene) => {
      const assets = sceneAssets.find((a) => a.sceneId === scene.id);
      return { sceneId: scene.id, audio: assets?.audio };
    });

    // Phase 3: Assemble frames + audio into the final video
    const renderedVideo = await this.videoAssembler.assembleVideo({
      frames,
      audioTracks,
      fps,
      outputPath,
    });

    this.logger.log(
      `Render complete: ${renderedVideo.videoPath} (${renderedVideo.duration.toFixed(1)}s)`,
    );
    return renderedVideo;
  }

  private async composeAllFrames(
    request: IRenderVideoRequest,
    resolutionSpec: (typeof VIDEO_RESOLUTION_MAP)[keyof typeof VIDEO_RESOLUTION_MAP],
    _fps: number,
  ): Promise<IComposedFrame[]> {
    const { script, sceneAssets } = request;

    const framePromises = script.scenes.map((scene) => {
      const assets = sceneAssets.find((a) => a.sceneId === scene.id);
      return this.frameComposer.composeFrame({
        sceneId: scene.id,
        sequenceNumber: scene.sequenceNumber,
        image: assets?.image,
        narration: scene.narration,
        duration: scene.duration,
        style: script.style,
        resolution: resolutionSpec,
      });
    });

    const results = await Promise.allSettled(framePromises);

    const frames: IComposedFrame[] = [];
    for (const [idx, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        frames.push(result.value);
      } else {
        this.logger.error(`Frame composition failed for scene ${idx + 1}: ${result.reason}`);
        throw new Error(`Frame composition failed for scene ${idx + 1}: ${result.reason}`);
      }
    }

    return frames;
  }
}
