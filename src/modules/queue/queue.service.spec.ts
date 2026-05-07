import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { VIDEO_QUEUE_TOKEN, VIDEO_JOB_NAME } from './constants/queue.constants';
import { IVideoJobData, VideoJobStatus } from '../../domain/interfaces/video-job.interface';
import { VideoPlatform, VideoStyle } from '../../domain/enums/video.enums';
import { VideoResolution } from '../../domain/interfaces/rendering.interface';

const buildJobData = (): IVideoJobData => ({
  topic: 'How photosynthesis works in plants',
  platform: VideoPlatform.YOUTUBE,
  style: VideoStyle.CARTOON,
  targetDuration: 30,
  resolution: VideoResolution.HD_720P,
  fps: 30,
});

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
      getJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueService, { provide: VIDEO_QUEUE_TOKEN, useValue: mockQueue }],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueVideoGeneration', () => {
    it('should add a job to the queue and return a job ID', async () => {
      // Arrange
      const data = buildJobData();

      // Act
      const result = await service.enqueueVideoGeneration(data);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(
        VIDEO_JOB_NAME,
        data,
        expect.objectContaining({
          jobId: expect.any(String),
          attempts: 3,
        }),
      );
      expect(result.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result.status).toBe(VideoJobStatus.WAITING);
      expect(result.message).toBeDefined();
    });
  });

  describe('getJobStatus', () => {
    it('should return null when job is not found', async () => {
      // Arrange
      mockQueue.getJob.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.getJobStatus('nonexistent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should return waiting status for queued job', async () => {
      // Arrange
      const mockJob = {
        id: 'test-job-id',
        progress: 0,
        returnvalue: null,
        failedReason: null,
        timestamp: Date.now(),
        processedOn: null,
        finishedOn: null,
        getState: jest.fn().mockResolvedValue('waiting'),
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      // Act
      const result = await service.getJobStatus('test-job-id');

      // Assert
      expect(result?.status).toBe(VideoJobStatus.WAITING);
      expect(result?.jobId).toBe('test-job-id');
      expect(result?.result).toBeUndefined();
    });

    it('should return completed status with result', async () => {
      // Arrange
      const jobResult = {
        videoPath: '/storage/output.mp4',
        title: 'Test',
        description: 'desc',
        totalScenes: 2,
        duration: 30,
        width: 1280,
        height: 720,
        fps: 30,
        fileSize: 1024 * 1024,
        scriptProvider: 'openai',
        imageProvider: 'dalle',
        audioProvider: 'openai',
        generatedAt: new Date(),
      };
      const mockJob = {
        id: 'done-job-id',
        progress: 100,
        returnvalue: jobResult,
        failedReason: null,
        timestamp: Date.now() - 60000,
        processedOn: Date.now() - 30000,
        finishedOn: Date.now(),
        getState: jest.fn().mockResolvedValue('completed'),
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      // Act
      const result = await service.getJobStatus('done-job-id');

      // Assert
      expect(result?.status).toBe(VideoJobStatus.COMPLETED);
      expect(result?.result).toEqual(jobResult);
      expect(result?.error).toBeUndefined();
    });

    it('should return failed status with error message', async () => {
      // Arrange
      const mockJob = {
        id: 'failed-job-id',
        progress: 0,
        returnvalue: null,
        failedReason: 'OpenAI API quota exceeded',
        timestamp: Date.now() - 30000,
        processedOn: Date.now() - 10000,
        finishedOn: Date.now(),
        getState: jest.fn().mockResolvedValue('failed'),
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      // Act
      const result = await service.getJobStatus('failed-job-id');

      // Assert
      expect(result?.status).toBe(VideoJobStatus.FAILED);
      expect(result?.error).toBe('OpenAI API quota exceeded');
      expect(result?.result).toBeUndefined();
    });

    it('should return active status with progress', async () => {
      // Arrange
      const mockJob = {
        id: 'active-job-id',
        progress: 45,
        returnvalue: null,
        failedReason: null,
        timestamp: Date.now() - 10000,
        processedOn: Date.now() - 5000,
        finishedOn: null,
        getState: jest.fn().mockResolvedValue('active'),
      };
      mockQueue.getJob.mockResolvedValueOnce(mockJob);

      // Act
      const result = await service.getJobStatus('active-job-id');

      // Assert
      expect(result?.status).toBe(VideoJobStatus.ACTIVE);
      expect(result?.progress).toBe(45);
    });
  });
});
