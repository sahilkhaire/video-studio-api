import { VideoPlatform, VideoStyle } from '../enums/video.enums';
import { VideoResolution, VideoAspectRatio } from './rendering.interface';
import { ScriptProvider, ImageProvider, TTSProvider } from '../../config/providers.config';

// ──────────────────────────────────────────────────────────
// Job status
// ──────────────────────────────────────────────────────────
export enum VideoJobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
}

export enum VideoJobType {
  STANDARD = 'standard',
  MUSIC_VISUAL_STORY = 'music-visual-story',
}

// ──────────────────────────────────────────────────────────
// Job payload — what the producer puts on the queue
// ──────────────────────────────────────────────────────────
export interface IVideoJobData {
  jobType?: VideoJobType;
  topic: string;
  platform: VideoPlatform;
  style?: VideoStyle;
  targetDuration: number;
  targetAudience?: string;
  additionalContext?: string;
  resolution?: VideoResolution;
  aspectRatio?: VideoAspectRatio;
  fps?: number;
  scriptProvider?: ScriptProvider;
  imageProvider?: ImageProvider;
  ttsProvider?: TTSProvider;
  callbackUrl?: string;
}

export interface IMusicVideoJobData {
  jobType: VideoJobType.MUSIC_VISUAL_STORY;
  topic: string;
  style?: VideoStyle;
  lyrics?: string;
  additionalContext?: string;
  musicPath?: string;
  musicUrl?: string;
  uploadedMusicPath?: string;
  fps?: number;
  youtubeResolution?: VideoResolution;
  reelsResolution?: VideoResolution;
  scriptProvider?: ScriptProvider;
  imageProvider?: ImageProvider;
  imageModel?: string;
  callbackUrl?: string;
}

export type IVideoQueueJobData = IVideoJobData | IMusicVideoJobData;

// ──────────────────────────────────────────────────────────
// Successful result — stored in job.returnvalue by BullMQ
// ──────────────────────────────────────────────────────────
export interface IVideoJobResult {
  videoPath: string;
  title: string;
  description: string;
  totalScenes: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  fileSize: number;
  scriptProvider: string;
  imageProvider: string;
  audioProvider: string;
  generatedAt: Date;
}

export interface IMusicVideoVariantResult {
  platform: VideoPlatform;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  videoPath: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  fileSize: number;
}

export interface IMusicVideoJobResult {
  mode: VideoJobType.MUSIC_VISUAL_STORY;
  title: string;
  description: string;
  totalScenes: number;
  variants: IMusicVideoVariantResult[];
  scriptProvider: string;
  imageProvider: string;
  generatedAt: Date;
}

export type IVideoQueueJobResult = IVideoJobResult | IMusicVideoJobResult;

// ──────────────────────────────────────────────────────────
// Status response returned by the API GET endpoint
// ──────────────────────────────────────────────────────────
export interface IVideoJobStatusResponse {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  result?: IVideoQueueJobResult;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

// ──────────────────────────────────────────────────────────
// Response when a job is enqueued
// ──────────────────────────────────────────────────────────
export interface IEnqueueJobResponse {
  jobId: string;
  status: VideoJobStatus.WAITING;
  message: string;
}
