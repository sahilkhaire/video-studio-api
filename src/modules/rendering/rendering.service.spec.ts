import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

jest.mock('canvas', () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
}));

import { RenderingService } from './rendering.service';
import { FrameComposerService } from './frame-composer.service';
import { VideoAssemblerService } from './video-assembler.service';
import { IRenderVideoRequest, VideoResolution } from '../../domain/interfaces/rendering.interface';
import {
  VideoPlatform,
  VideoStyle,
  SceneTransition,
  ImageFormat,
  AudioFormat,
} from '../../domain/enums/video.enums';
import { ISceneAssets } from '../content/content.service';

const buildMockRequest = (): IRenderVideoRequest => ({
  script: {
    title: 'Test Video',
    description: 'A test video',
    platform: VideoPlatform.YOUTUBE,
    style: VideoStyle.CARTOON,
    scenes: [
      {
        id: 'scene-1',
        sequenceNumber: 1,
        narration: 'Scene one narration.',
        imageDescription: 'A cartoon forest',
        duration: 8,
        transition: SceneTransition.FADE,
      },
      {
        id: 'scene-2',
        sequenceNumber: 2,
        narration: 'Scene two narration.',
        imageDescription: 'A cartoon sky',
        duration: 8,
        transition: SceneTransition.CUT,
      },
    ],
    totalDuration: 16,
    generatedAt: new Date(),
  },
  sceneAssets: [
    {
      sceneId: 'scene-1',
      sequenceNumber: 1,
      image: {
        url: 'https://example.com/1.png',
        width: 1024,
        height: 1024,
        format: ImageFormat.PNG,
        prompt: 'test',
      },
      audio: {
        filePath: '/tmp/1.mp3',
        duration: 8,
        format: AudioFormat.MP3,
        sampleRate: 24000,
        text: 'Scene one narration.',
      },
    },
    {
      sceneId: 'scene-2',
      sequenceNumber: 2,
      image: {
        url: 'https://example.com/2.png',
        width: 1024,
        height: 1024,
        format: ImageFormat.PNG,
        prompt: 'test',
      },
      audio: {
        filePath: '/tmp/2.mp3',
        duration: 8,
        format: AudioFormat.MP3,
        sampleRate: 24000,
        text: 'Scene two narration.',
      },
    },
  ] as ISceneAssets[],
  resolution: VideoResolution.HD_720P,
  fps: 30,
});

describe('RenderingService', () => {
  let service: RenderingService;
  let mockFrameComposer: jest.Mocked<FrameComposerService>;
  let mockVideoAssembler: jest.Mocked<VideoAssemblerService>;

  beforeEach(async () => {
    mockFrameComposer = {
      composeFrame: jest.fn(),
    } as unknown as jest.Mocked<FrameComposerService>;

    mockVideoAssembler = {
      assembleVideo: jest.fn(),
    } as unknown as jest.Mocked<VideoAssemblerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenderingService,
        { provide: FrameComposerService, useValue: mockFrameComposer },
        { provide: VideoAssemblerService, useValue: mockVideoAssembler },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(30) },
        },
      ],
    }).compile();

    service = module.get<RenderingService>(RenderingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('renderVideo', () => {
    it('should compose frames for all scenes and assemble the video', async () => {
      // Arrange
      const request = buildMockRequest();
      const mockFrame = {
        sceneId: 'scene-1',
        sequenceNumber: 1,
        framePath: '/tmp/f.png',
        width: 1280,
        height: 720,
        duration: 8,
      };

      mockFrameComposer.composeFrame.mockResolvedValue(mockFrame);
      mockVideoAssembler.assembleVideo.mockResolvedValue({
        videoPath: '/storage/video.mp4',
        width: 1280,
        height: 720,
        duration: 16,
        fps: 30,
        fileSize: 1024 * 1024,
        format: 'mp4',
      });

      // Act
      const result = await service.renderVideo(request);

      // Assert
      expect(mockFrameComposer.composeFrame).toHaveBeenCalledTimes(2);
      expect(mockVideoAssembler.assembleVideo).toHaveBeenCalledTimes(1);
      expect(result.videoPath).toBe('/storage/video.mp4');
      expect(result.duration).toBe(16);
    });

    it('should use default fps when not specified in request', async () => {
      // Arrange
      const request = buildMockRequest();
      delete (request as Partial<IRenderVideoRequest>).fps;

      mockFrameComposer.composeFrame.mockResolvedValue({
        sceneId: 'scene-1',
        sequenceNumber: 1,
        framePath: '/tmp/f.png',
        width: 1280,
        height: 720,
        duration: 8,
      });
      mockVideoAssembler.assembleVideo.mockResolvedValue({
        videoPath: '/storage/video.mp4',
        width: 1280,
        height: 720,
        duration: 16,
        fps: 30,
        fileSize: 1024,
        format: 'mp4',
      });

      // Act
      await service.renderVideo(request);

      // Assert: assembleVideo must be called with fps=30 (from ConfigService)
      expect(mockVideoAssembler.assembleVideo).toHaveBeenCalledWith(
        expect.objectContaining({ fps: 30 }),
      );
    });

    it('should throw if any frame composition fails', async () => {
      // Arrange
      const request = buildMockRequest();
      mockFrameComposer.composeFrame
        .mockResolvedValueOnce({
          sceneId: 'scene-1',
          sequenceNumber: 1,
          framePath: '/tmp/f.png',
          width: 1280,
          height: 720,
          duration: 8,
        })
        .mockRejectedValueOnce(new Error('Canvas error'));

      // Act & Assert
      await expect(service.renderVideo(request)).rejects.toThrow('Frame composition failed');
    });

    it('should still render when some scenes are missing assets', async () => {
      // Arrange
      const request = buildMockRequest();
      request.sceneAssets = []; // no assets

      mockFrameComposer.composeFrame.mockResolvedValue({
        sceneId: 'scene-1',
        sequenceNumber: 1,
        framePath: '/tmp/f.png',
        width: 1280,
        height: 720,
        duration: 8,
      });
      mockVideoAssembler.assembleVideo.mockResolvedValue({
        videoPath: '/storage/video.mp4',
        width: 1280,
        height: 720,
        duration: 16,
        fps: 30,
        fileSize: 1024,
        format: 'mp4',
      });

      // Act
      const result = await service.renderVideo(request);

      // Assert: renders without throwing
      expect(result.videoPath).toBe('/storage/video.mp4');
    });
  });
});
