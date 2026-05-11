import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

jest.mock('canvas', () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
}));

import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { QueueService } from '../queue/queue.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import {
  IEnqueueJobResponse,
  IVideoJobStatusResponse,
  VideoJobStatus,
} from '../../domain/interfaces/video-job.interface';
import { VideoPlatform, VideoStyle } from '../../domain/enums/video.enums';
import { VideoResolution } from '../../domain/interfaces/rendering.interface';
import { VideoAspectRatio } from '../../domain/interfaces/rendering.interface';

describe('VideoController', () => {
  let controller: VideoController;
  let mockVideoService: jest.Mocked<VideoService>;
  let mockQueueService: jest.Mocked<QueueService>;

  const validRequest: GenerateVideoRequestDto = {
    topic: 'How photosynthesis works in plants',
    platform: VideoPlatform.YOUTUBE,
    style: VideoStyle.CARTOON,
    targetDuration: 30,
    resolution: VideoResolution.HD_720P,
    fps: 30,
  };

  beforeEach(async () => {
    mockVideoService = {
      getActiveProviders: jest
        .fn()
        .mockReturnValue({ script: 'openai', image: 'dalle', tts: 'openai' }),
      notifyCallback: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<VideoService>;

    mockQueueService = {
      enqueueVideoGeneration: jest.fn(),
      getJobStatus: jest.fn(),
    } as unknown as jest.Mocked<QueueService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoController],
      providers: [
        { provide: VideoService, useValue: mockVideoService },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    controller = module.get<VideoController>(VideoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('enqueueVideo', () => {
    it('should enqueue a job and return a jobId with waiting status', async () => {
      // Arrange
      const enqueueResponse: IEnqueueJobResponse = {
        jobId: 'abc-123',
        status: VideoJobStatus.WAITING,
        message: 'Video generation job queued successfully',
      };
      mockQueueService.enqueueVideoGeneration.mockResolvedValueOnce(enqueueResponse);

      // Act
      const result = await controller.enqueueVideo(validRequest);

      // Assert
      expect(mockQueueService.enqueueVideoGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: validRequest.topic,
          platform: validRequest.platform,
        }),
      );
      expect(result.jobId).toBe('abc-123');
      expect(result.status).toBe(VideoJobStatus.WAITING);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      // Arrange
      const statusResponse: IVideoJobStatusResponse = {
        jobId: 'abc-123',
        status: VideoJobStatus.ACTIVE,
        progress: 30,
        createdAt: new Date(),
        processedAt: new Date(),
      };
      mockQueueService.getJobStatus.mockResolvedValueOnce(statusResponse);

      // Act
      const result = await controller.getJobStatus('abc-123');

      // Assert
      expect(result.jobId).toBe('abc-123');
      expect(result.status).toBe(VideoJobStatus.ACTIVE);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      // Arrange
      mockQueueService.getJobStatus.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(controller.getJobStatus('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('should return completed job with result', async () => {
      // Arrange
      const completedStatus: IVideoJobStatusResponse = {
        jobId: 'done-123',
        status: VideoJobStatus.COMPLETED,
        progress: 100,
        result: {
          videoPath: '/storage/output.mp4',
          title: 'Test Video',
          description: 'desc',
          totalScenes: 3,
          duration: 30,
          width: 1280,
          height: 720,
          fps: 30,
          fileSize: 1024 * 1024,
          scriptProvider: 'openai',
          imageProvider: 'dalle',
          audioProvider: 'openai',
          generatedAt: new Date(),
        },
        createdAt: new Date(),
      };
      mockQueueService.getJobStatus.mockResolvedValueOnce(completedStatus);

      // Act
      const result = await controller.getJobStatus('done-123');

      // Assert
      expect(result.status).toBe(VideoJobStatus.COMPLETED);
      if (!result.result || !('videoPath' in result.result)) {
        throw new Error('Expected standard video result shape');
      }
      expect(result.result.videoPath).toBe('/storage/output.mp4');
    });
  });

  describe('getProviders', () => {
    it('should return active provider names from VideoService', () => {
      // Act
      const result = controller.getProviders();

      // Assert
      expect(result).toEqual({ script: 'openai', image: 'dalle', tts: 'openai' });
    });
  });

  describe('generateFromContentImages', () => {
    it('should delegate request to VideoService', async () => {
      const response = {
        video: {
          videoPath: '/storage/generated.mp4',
          width: 1280,
          height: 720,
          duration: 12,
          fps: 30,
          fileSize: 1024,
          format: 'mp4',
        },
        title: 'Content and Images Video',
        description: 'Generated from user-provided content segments and image lists.',
        totalScenes: 2,
        scriptProvider: 'user-input',
        imageProvider: 'user-input',
        audioProvider: 'edge-tts',
        generatedAt: new Date(),
      };

      (
        mockVideoService as unknown as { generateVideoFromContentImages: jest.Mock }
      ).generateVideoFromContentImages = jest.fn().mockResolvedValueOnce(response);

      const payload = {
        data: [
          {
            content: 'Intro narration',
            images: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
          },
        ],
        showCaptions: true,
        resolution: VideoResolution.HD_720P,
        aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
        fps: 30,
      };

      const result = await controller.generateFromContentImages(payload);

      expect(
        (mockVideoService as unknown as { generateVideoFromContentImages: jest.Mock })
          .generateVideoFromContentImages,
      ).toHaveBeenCalledWith(payload);
      expect(result).toEqual(response);
    });

    it('should call callback URL for direct generation when callbackUrl is provided', async () => {
      const response = {
        video: {
          videoPath: '/storage/generated.mp4',
          width: 1280,
          height: 720,
          duration: 12,
          fps: 30,
          fileSize: 1024,
          format: 'mp4',
        },
        title: 'Content and Images Video',
        description: 'Generated from user-provided content segments and image lists.',
        totalScenes: 2,
        scriptProvider: 'user-input',
        imageProvider: 'user-input',
        audioProvider: 'edge-tts',
        generatedAt: new Date(),
      };

      (
        mockVideoService as unknown as { generateVideoFromContentImages: jest.Mock }
      ).generateVideoFromContentImages = jest.fn().mockResolvedValueOnce(response);

      await controller.generateFromContentImages({
        data: [
          {
            content: 'Intro narration',
            images: ['https://example.com/1.jpg'],
          },
        ],
        callbackUrl: 'https://client.example.com/video-callback',
      });

      expect(mockVideoService.notifyCallback).toHaveBeenCalledWith(
        'https://client.example.com/video-callback',
        expect.objectContaining({
          status: 'completed',
          videoUrl: '/storage/generated.mp4',
          jobId: expect.any(String),
        }),
      );
    });
  });
});
