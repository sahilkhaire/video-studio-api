import { VideoPlatform, VideoStyle } from '../enums/video.enums';
import { VideoResolution } from './rendering.interface';

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

// ──────────────────────────────────────────────────────────
// Job payload — what the producer puts on the queue
// ──────────────────────────────────────────────────────────
export interface IVideoJobData {
  topic: string;
  platform: VideoPlatform;
  style?: VideoStyle;
  targetDuration: number;
  targetAudience?: string;
  additionalContext?: string;
  resolution?: VideoResolution;
  fps?: number;
}

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

// ──────────────────────────────────────────────────────────
// Status response returned by the API GET endpoint
// ──────────────────────────────────────────────────────────
export interface IVideoJobStatusResponse {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  result?: IVideoJobResult;
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
