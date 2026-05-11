import { Test, TestingModule } from '@nestjs/testing';

jest.mock('canvas', () => ({
  createCanvas: jest.fn(),
  loadImage: jest.fn(),
}));

import { VideoService, IVideoGenerationResult } from './video.service';
import { ContentService } from '../content/content.service';
import { RenderingService } from '../rendering/rendering.service';
import { EdgeTTSProvider } from '../content/providers/tts/edge-tts.provider';
import { VideoJobRepository } from '../database/repositories/video-job.repository';
import { CostRecordRepository } from '../database/repositories/cost-record.repository';
import { ConfigService } from '@nestjs/config';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import {
  VideoPlatform,
  VideoStyle,
  SceneTransition,
  ImageFormat,
  AudioFormat,
} from '../../domain/enums/video.enums';
import { VideoResolution } from '../../domain/interfaces/rendering.interface';
import { VideoAspectRatio } from '../../domain/interfaces/rendering.interface';

describe('VideoService', () => {
  let service: VideoService;
  let mockContentService: jest.Mocked<ContentService>;
  let mockRenderingService: jest.Mocked<RenderingService>;

  const validRequest: GenerateVideoRequestDto = {
    topic: 'How photosynthesis works in plants',
    platform: VideoPlatform.YOUTUBE,
    style: VideoStyle.CARTOON,
    targetDuration: 30,
    resolution: VideoResolution.HD_720P,
    fps: 30,
  };

  const mockContent = {
    script: {
      title: 'Photosynthesis Explained',
      description: 'A short cartoon about photosynthesis.',
      platform: VideoPlatform.YOUTUBE,
      style: VideoStyle.CARTOON,
      scenes: [
        {
          id: 'scene-1',
          sequenceNumber: 1,
          narration: 'Plants use sunlight.',
          imageDescription: 'A bright leaf',
          duration: 15,
          transition: SceneTransition.FADE,
        },
      ],
      totalDuration: 15,
      generatedAt: new Date(),
    },
    sceneAssets: [
      {
        sceneId: 'scene-1',
        sequenceNumber: 1,
        image: {
          url: 'https://example.com/img.png',
          width: 1024,
          height: 1024,
          format: ImageFormat.PNG,
          prompt: 'x',
        },
        audio: {
          filePath: '/tmp/a.mp3',
          duration: 6,
          format: AudioFormat.MP3,
          sampleRate: 24000,
          text: 'Plants use sunlight.',
        },
      },
    ],
    scriptProvider: 'openai',
    imageProvider: 'dalle',
    audioProvider: 'openai',
    generatedAt: new Date(),
  };

  const mockRenderedVideo = {
    videoPath: '/storage/output.mp4',
    width: 1280,
    height: 720,
    duration: 15,
    fps: 30,
    fileSize: 2 * 1024 * 1024,
    format: 'mp4',
  };

  beforeEach(async () => {
    mockContentService = {
      generateVideoContent: jest.fn(),
      getActiveProviders: jest.fn(),
      generateScript: jest.fn(),
      generateImage: jest.fn(),
      generateAudio: jest.fn(),
    } as unknown as jest.Mocked<ContentService>;

    mockRenderingService = {
      renderVideo: jest.fn(),
    } as unknown as jest.Mocked<RenderingService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        { provide: ContentService, useValue: mockContentService },
        { provide: RenderingService, useValue: mockRenderingService },
        {
          provide: VideoJobRepository,
          useValue: { save: jest.fn(), findById: jest.fn(), findAll: jest.fn() },
        },
        { provide: CostRecordRepository, useValue: { save: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(2) } },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateVideo', () => {
    it('should orchestrate content generation and rendering', async () => {
      // Arrange
      mockContentService.generateVideoContent.mockResolvedValueOnce(mockContent);
      mockRenderingService.renderVideo.mockResolvedValueOnce(mockRenderedVideo);

      // Act
      const result: IVideoGenerationResult = await service.generateVideo(validRequest);

      // Assert
      expect(mockContentService.generateVideoContent).toHaveBeenCalledWith(
        validRequest,
        undefined,
        expect.any(String),
      );
      expect(mockRenderingService.renderVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          script: mockContent.script,
          sceneAssets: mockContent.sceneAssets,
          resolution: VideoResolution.HD_720P,
          fps: 30,
        }),
      );
      expect(result.video).toBe(mockRenderedVideo);
      expect(result.title).toBe('Photosynthesis Explained');
      expect(result.totalScenes).toBe(1);
      expect(result.scriptProvider).toBe('openai');
      expect(result.imageProvider).toBe('dalle');
      expect(result.audioProvider).toBe('openai');
    });

    it('should default to HD_720P when resolution not specified', async () => {
      // Arrange
      const requestWithoutRes: GenerateVideoRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 30,
      };
      mockContentService.generateVideoContent.mockResolvedValueOnce(mockContent);
      mockRenderingService.renderVideo.mockResolvedValueOnce(mockRenderedVideo);

      // Act
      await service.generateVideo(requestWithoutRes);

      // Assert
      expect(mockRenderingService.renderVideo).toHaveBeenCalledWith(
        expect.objectContaining({ resolution: VideoResolution.HD_720P }),
      );
    });

    it('should propagate content generation errors', async () => {
      // Arrange
      mockContentService.generateVideoContent.mockRejectedValueOnce(
        new Error('OpenAI quota exceeded'),
      );

      // Act & Assert
      await expect(service.generateVideo(validRequest)).rejects.toThrow('OpenAI quota exceeded');
    });

    it('should propagate rendering errors', async () => {
      // Arrange
      mockContentService.generateVideoContent.mockResolvedValueOnce(mockContent);
      mockRenderingService.renderVideo.mockRejectedValueOnce(new Error('FFmpeg not found'));

      // Act & Assert
      await expect(service.generateVideo(validRequest)).rejects.toThrow('FFmpeg not found');
    });
  });

  describe('getActiveProviders', () => {
    it('should delegate to contentService', () => {
      // Arrange
      mockContentService.getActiveProviders.mockReturnValue({
        script: 'claude',
        image: 'dalle',
        tts: 'elevenlabs',
      });

      // Act
      const result = service.getActiveProviders();

      // Assert
      expect(result).toEqual({ script: 'claude', image: 'dalle', tts: 'elevenlabs' });
    });
  });

  describe('generateVideoFromContentImages', () => {
    it('should generate scene graph with Edge TTS and render final video', async () => {
      const edgeAudioSpy = jest
        .spyOn(EdgeTTSProvider.prototype, 'generateAudio')
        .mockResolvedValue({
          filePath: '/tmp/edge-audio.mp3',
          duration: 8,
          format: AudioFormat.MP3,
          sampleRate: 24000,
          text: 'Intro narration',
        });

      mockRenderingService.renderVideo.mockResolvedValueOnce(mockRenderedVideo);

      const result = await service.generateVideoFromContentImages({
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
      });

      expect(edgeAudioSpy).toHaveBeenCalledTimes(1);
      expect(mockRenderingService.renderVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: VideoResolution.HD_720P,
          aspectRatio: VideoAspectRatio.LANDSCAPE_16_9,
          fps: 30,
          showCaptions: true,
        }),
      );
      expect(result.audioProvider).toBe('edge-tts');
      expect(result.totalScenes).toBe(2);

      edgeAudioSpy.mockRestore();
    });
  });
});
