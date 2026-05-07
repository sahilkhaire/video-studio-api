import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VideoJob, VideoJobDocument } from '../schemas/video-job.schema';
import { VideoJobStatus, IVideoJobData, IVideoJobResult } from '../../../domain/interfaces/video-job.interface';

@Injectable()
export class VideoJobRepository {
  constructor(
    @InjectModel(VideoJob.name)
    private readonly model: Model<VideoJobDocument>,
  ) {}

  async create(jobId: string, data: IVideoJobData): Promise<VideoJobDocument> {
    return this.model.create({
      jobId,
      topic: data.topic,
      platform: data.platform,
      style: data.style,
      targetDuration: data.targetDuration,
      targetAudience: data.targetAudience,
      additionalContext: data.additionalContext,
      resolution: data.resolution,
      fps: data.fps,
      status: VideoJobStatus.WAITING,
      progress: 0,
    });
  }

  async markActive(jobId: string): Promise<void> {
    await this.model.updateOne(
      { jobId },
      { $set: { status: VideoJobStatus.ACTIVE, processedAt: new Date(), progress: 5 } },
    );
  }

  async updateProgress(jobId: string, progress: number): Promise<void> {
    await this.model.updateOne({ jobId }, { $set: { progress } });
  }

  async markCompleted(jobId: string, result: IVideoJobResult): Promise<void> {
    await this.model.updateOne(
      { jobId },
      { $set: { status: VideoJobStatus.COMPLETED, progress: 100, result, finishedAt: new Date() } },
    );
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.model.updateOne(
      { jobId },
      { $set: { status: VideoJobStatus.FAILED, error, finishedAt: new Date() } },
    );
  }

  async findByJobId(jobId: string): Promise<VideoJobDocument | null> {
    return this.model.findOne({ jobId }).exec();
  }

  async findAll(limit = 50, skip = 0): Promise<VideoJobDocument[]> {
    return this.model.find().sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
  }
}
