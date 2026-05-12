import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { VideoPlatform, VideoStyle } from '../../../domain/enums/video.enums';
import { VideoJobStatus, VideoJobType } from '../../../domain/interfaces/video-job.interface';
import { VideoResolution, VideoAspectRatio } from '../../../domain/interfaces/rendering.interface';

export type VideoJobDocument = HydratedDocument<VideoJob>;

@Schema({ timestamps: true, collection: 'video_jobs' })
export class VideoJob {
  // ── Request payload ───────────────────────────────────────────────
  @Prop({ required: true, index: true })
  jobId!: string;

  @Prop({ required: true })
  topic!: string;

  @Prop({ required: true, enum: VideoPlatform })
  platform!: VideoPlatform;

  @Prop({ enum: VideoStyle })
  style?: VideoStyle;

  @Prop({ required: true })
  targetDuration!: number;

  @Prop()
  targetAudience?: string;

  @Prop()
  additionalContext?: string;

  @Prop({ enum: VideoResolution })
  resolution?: VideoResolution;

  @Prop({ enum: VideoAspectRatio })
  aspectRatio?: VideoAspectRatio;

  @Prop()
  fps?: number;

  @Prop({ enum: VideoJobType })
  jobType?: VideoJobType;

  @Prop()
  lyrics?: string;

  @Prop()
  musicPath?: string;

  @Prop()
  musicUrl?: string;

  @Prop()
  uploadedMusicPath?: string;

  @Prop()
  scriptProvider?: string;

  @Prop()
  imageProvider?: string;

  @Prop()
  imageModel?: string;

  @Prop()
  ttsProvider?: string;

  // ── Lifecycle ─────────────────────────────────────────────────────
  @Prop({ required: true, enum: VideoJobStatus, default: VideoJobStatus.WAITING, index: true })
  status!: VideoJobStatus;

  @Prop({ default: 0 })
  progress!: number;

  @Prop()
  processedAt?: Date;

  @Prop()
  finishedAt?: Date;

  // ── Result (set on success) ────────────────────────────────────────
  @Prop({ type: Object })
  result?: {
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
  };

  // ── Failure (set on error) ─────────────────────────────────────────
  @Prop()
  error?: string;

  // ── Auto-timestamps (set by Mongoose) ─────────────────────────────
  createdAt!: Date;
  updatedAt!: Date;
}

export const VideoJobSchema = SchemaFactory.createForClass(VideoJob);

// Compound index for listing jobs by platform + status
VideoJobSchema.index({ platform: 1, status: 1 });
