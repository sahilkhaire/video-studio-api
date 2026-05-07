import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { VIDEO_QUEUE_TOKEN, VIDEO_JOB_NAME } from './constants/queue.constants';
import {
  IVideoJobData,
  IVideoJobResult,
  IVideoJobStatusResponse,
  IEnqueueJobResponse,
  VideoJobStatus,
} from '../../domain/interfaces/video-job.interface';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(VIDEO_QUEUE_TOKEN)
    private readonly videoQueue: Queue<IVideoJobData, IVideoJobResult>,
  ) {}

  async enqueueVideoGeneration(data: IVideoJobData): Promise<IEnqueueJobResponse> {
    const jobId = uuidv4();
    await this.videoQueue.add(VIDEO_JOB_NAME, data, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 * 24 }, // keep 24h
      removeOnFail: { age: 3600 * 24 * 7 }, // keep 7 days
    });

    this.logger.log(`Enqueued video job ${jobId} — topic: "${data.topic}"`);

    return {
      jobId,
      status: VideoJobStatus.WAITING,
      message: 'Video generation job queued successfully',
    };
  }

  async getJobStatus(jobId: string): Promise<IVideoJobStatusResponse | null> {
    const job: Job<IVideoJobData, IVideoJobResult> | undefined =
      await this.videoQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const bullState = await job.getState();
    const status = this.mapBullStateToStatus(bullState);

    return {
      jobId: job.id ?? jobId,
      status,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      result: status === VideoJobStatus.COMPLETED ? job.returnvalue : undefined,
      error: status === VideoJobStatus.FAILED ? (job.failedReason ?? 'Unknown error') : undefined,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  private mapBullStateToStatus(state: string): VideoJobStatus {
    const map: Record<string, VideoJobStatus> = {
      waiting: VideoJobStatus.WAITING,
      active: VideoJobStatus.ACTIVE,
      completed: VideoJobStatus.COMPLETED,
      failed: VideoJobStatus.FAILED,
      delayed: VideoJobStatus.DELAYED,
      prioritized: VideoJobStatus.WAITING,
      paused: VideoJobStatus.WAITING,
      'wait-children': VideoJobStatus.ACTIVE,
    };
    return map[state] ?? VideoJobStatus.WAITING;
  }
}
