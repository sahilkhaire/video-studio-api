import { IVideoScript } from './script-generator.interface';
import { ISceneAssets } from '../../modules/content/content.service';

export enum VideoResolution {
  SD_480P = '480p',
  HD_720P = '720p',
  FULL_HD_1080P = '1080p',
}

export interface IVideoResolutionSpec {
  width: number;
  height: number;
  label: VideoResolution;
}

export const VIDEO_RESOLUTION_MAP: Record<VideoResolution, IVideoResolutionSpec> = {
  [VideoResolution.SD_480P]: { width: 854, height: 480, label: VideoResolution.SD_480P },
  [VideoResolution.HD_720P]: { width: 1280, height: 720, label: VideoResolution.HD_720P },
  [VideoResolution.FULL_HD_1080P]: {
    width: 1920,
    height: 1080,
    label: VideoResolution.FULL_HD_1080P,
  },
};

export interface IComposedFrame {
  sceneId: string;
  sequenceNumber: number;
  framePath: string;
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
  fps?: number;
  outputPath?: string;
}
