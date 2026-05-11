import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

jest.mock('canvas', () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
}));

import { VideoProcessor } from './video.processor';
import { VideoService } from '../video/video.service';
import { VideoJobRepository } from '../database/repositories/video-job.repository';
import { IVideoJobData, IVideoJobResult } from '../../domain/interfaces/video-job.interface';
import { VideoPlatform, VideoStyle } from '../../domain/enums/video.enums';
import { VideoResolution } from '../../domain/interfaces/rendering.interface';

// Prevent the Worker from actually connecting to Redis in unit tests
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Queue: jest.fn(),
}));

const makeJob = (data: IVideoJobData): jest.Mocked<Job<IVideoJobData, IVideoJobResult>> =>
  ({
    id: 'test-job-id',
    data,
    updateProgress: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<Job<IVideoJobData, IVideoJobResult>>;

describe('VideoProcessor', () => {
  let processor: VideoProcessor;
  let mockVideoService: jest.Mocked<VideoService>;

  const jobData: IVideoJobData = {
    topic: 'How photosynthesis works in plants',
    platform: VideoPlatform.YOUTUBE,
    style: VideoStyle.CARTOON,
    targetDuration: 30,
    resolution: VideoResolution.HD_720P,
    fps: 30,
  };

  const mockGenerationResult = {
    video: {
      videoPath: '/storage/output.mp4',
      width: 1280,
      height: 720,
      duration: 30,
      fps: 30,
      fileSize: 2 * 1024 * 1024,
      format: 'mp4',
    },
    title: 'Photosynthesis Explained',
    description: 'A cartoon about photosynthesis.',
    totalScenes: 3,
    scriptProvider: 'openai',
    imageProvider: 'dalle',
    audioProvider: 'openai',
    generatedAt: new Date(),
  };

  beforeEach(async () => {
    mockVideoService = {
      generateVideo: jest.fn().mockResolvedValue(mockGenerationResult),
      getActiveProviders: jest.fn(),
      notifyCallback: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<VideoService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoProcessor,
        { provide: VideoService, useValue: mockVideoService },
        {
          provide: VideoJobRepository,
          useValue: {
            save: jest.fn(),
            findById: jest.fn(),
            updateStatus: jest.fn(),
            markActive: jest.fn().mockResolvedValue(undefined),
            markCompleted: jest.fn().mockResolvedValue(undefined),
            markFailed: jest.fn().mockResolvedValue(undefined),
            updateProgress: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return def;
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<VideoProcessor>(VideoProcessor);

    // Trigger onModuleInit to set up the worker (mocked, no real Redis)
    processor.onModuleInit();
  });

  afterEach(async () => {
    await processor.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should call VideoService.generateVideo with mapped request and return result', async () => {
      // Arrange
      const job = makeJob(jobData);

      // Act
      const result = await processor.process(job);

      // Assert
      expect(mockVideoService.generateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: jobData.topic,
          platform: jobData.platform,
          style: jobData.style,
          targetDuration: jobData.targetDuration,
          resolution: jobData.resolution,
          fps: jobData.fps,
        }),
      );
      if (!('videoPath' in result)) {
        throw new Error('Expected standard video result shape');
      }
      expect(result.videoPath).toBe('/storage/output.mp4');
      expect(result.title).toBe('Photosynthesis Explained');
      expect(result.totalScenes).toBe(3);
      expect(result.scriptProvider).toBe('openai');
    });

    it('should update job progress during processing', async () => {
      // Arrange
      const job = makeJob(jobData);

      // Act
      await processor.process(job);

      // Assert
      expect(job.updateProgress).toHaveBeenCalledWith(5);
      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should propagate errors from VideoService', async () => {
      // Arrange
      mockVideoService.generateVideo.mockRejectedValueOnce(new Error('OpenAI quota exceeded'));
      const job = makeJob(jobData);

      // Act & Assert
      await expect(processor.process(job)).rejects.toThrow('OpenAI quota exceeded');
    });

    it('should map all optional fields from job data', async () => {
      // Arrange
      const richJobData: IVideoJobData = {
        ...jobData,
        targetAudience: 'students',
        additionalContext: 'focus on chlorophyll',
      };
      const job = makeJob(richJobData);

      // Act
      await processor.process(job);

      // Assert
      expect(mockVideoService.generateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAudience: 'students',
          additionalContext: 'focus on chlorophyll',
        }),
      );
    });

    it('should notify callback URL when job succeeds', async () => {
      const job = makeJob({
        ...jobData,
        callbackUrl: 'https://client.example.com/video-callback',
      });

      await processor.process(job);

      expect(mockVideoService.notifyCallback).toHaveBeenCalledWith(
        'https://client.example.com/video-callback',
        expect.objectContaining({
          jobId: 'test-job-id',
          status: 'completed',
          videoUrl: '/storage/output.mp4',
        }),
      );
    });
  });
});
