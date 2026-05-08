import { IVideoScript } from './script-generator.interface';
import { ISceneAssets } from '../../modules/content/content.service';

export enum VideoResolution {
  SD_480P = '480p',
  HD_720P = '720p',
  FULL_HD_1080P = '1080p',
}

export enum VideoAspectRatio {
  LANDSCAPE_16_9 = '16:9',
  PORTRAIT_9_16 = '9:16',
  SQUARE_1_1 = '1:1',
}

export interface IVideoResolutionSpec {
  width: number;
  height: number;
  label: VideoResolution;
  aspectRatio: VideoAspectRatio;
}

export const VIDEO_RESOLUTION_MAP: Record<VideoResolution, IVideoResolutionSpec> = {
  [VideoResolution.SD_480P]: {
    width: 854,
    height: 480,
    label: VideoResolution.SD_480P,
    aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
  },
  [VideoResolution.HD_720P]: {
    width: 1280,
    height: 720,
    label: VideoResolution.HD_720P,
    aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
  },
  [VideoResolution.FULL_HD_1080P]: {
    width: 1920,
    height: 1080,
    label: VideoResolution.FULL_HD_1080P,
    aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
  },
};

export function resolveVideoResolutionSpec(
  resolution: VideoResolution,
  aspectRatio: VideoAspectRatio = VideoAspectRatio.LANDSCAPE_16_9,
): IVideoResolutionSpec {
  const base = VIDEO_RESOLUTION_MAP[resolution];

  if (aspectRatio === VideoAspectRatio.LANDSCAPE_16_9) {
    return { ...base, aspectRatio };
  }

  if (aspectRatio === VideoAspectRatio.PORTRAIT_9_16) {
    return {
      width: base.height,
      height: base.width,
      label: base.label,
      aspectRatio,
    };
  }

  const minSide = Math.min(base.width, base.height);
  return {
    width: minSide,
    height: minSide,
    label: base.label,
    aspectRatio,
  };
}

export interface IComposedFrame {
  sceneId: string;
  sequenceNumber: number;
  framePath: string;
  captionPath?: string;
  width: number;
  height: number;
  duration: number;
}

export interface IRenderedVideo {
  videoPath: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  fileSize: number;
  format: string;
}

export interface IRenderVideoRequest {
  script: IVideoScript;
  sceneAssets: ISceneAssets[];
  resolution: VideoResolution;
  aspectRatio?: VideoAspectRatio;
  fps?: number;
  outputPath?: string;
  showCaptions?: boolean;
}

