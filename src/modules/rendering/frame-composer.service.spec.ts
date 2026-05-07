import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FrameComposerService, IComposeFrameOptions } from './frame-composer.service';
import { VideoStyle } from '../../domain/enums/video.enums';
import { VideoResolution, VIDEO_RESOLUTION_MAP } from '../../domain/interfaces/rendering.interface';
import { ImageFormat } from '../../domain/enums/video.enums';

// Mock heavy native dependencies
jest.mock('canvas', () => {
  const mockCtx = {
    createLinearGradient: jest.fn().mockReturnValue({
      addColorStop: jest.fn(),
    }),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    fill: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    closePath: jest.fn(),
    drawImage: jest.fn(),
    toBuffer: jest.fn().mockReturnValue(Buffer.from('png-data')),
    set fillStyle(_: unknown) {},
    set font(_: unknown) {},
    set textAlign(_: unknown) {},
    set shadowColor(_: unknown) {},
    set shadowBlur(_: unknown) {},
  };
  const mockCanvas = {
    getContext: jest.fn().mockReturnValue(mockCtx),
    toBuffer: jest.fn().mockReturnValue(Buffer.from('png-data')),
  };
  return {
    createCanvas: jest.fn().mockReturnValue(mockCanvas),
    loadImage: jest.fn().mockResolvedValue({ width: 1024, height: 1024 }),
  };
});

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('axios', () => ({
  default: { get: jest.fn() },
  get: jest.fn(),
}));

describe('FrameComposerService', () => {
  let service: FrameComposerService;

  const resolution720p = VIDEO_RESOLUTION_MAP[VideoResolution.HD_720P];

  const validOptions: IComposeFrameOptions = {
    sceneId: 'scene-abc-123',
    sequenceNumber: 1,
    narration: 'Plants absorb sunlight through their leaves.',
    duration: 8,
    style: VideoStyle.CARTOON,
    resolution: resolution720p,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrameComposerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('./temp') },
        },
      ],
    }).compile();

    service = module.get<FrameComposerService>(FrameComposerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('composeFrame', () => {
    it('should return a composed frame with correct metadata', async () => {
      // Act
      const result = await service.composeFrame(validOptions);

      // Assert
      expect(result.sceneId).toBe('scene-abc-123');
      expect(result.sequenceNumber).toBe(1);
      expect(result.duration).toBe(8);
      expect(result.width).toBe(resolution720p.width);
      expect(result.height).toBe(resolution720p.height);
      expect(result.framePath).toMatch(/\.png$/);
    });

    it('should compose a frame without an image (fallback background)', async () => {
      // Arrange
      const optionsWithoutImage: IComposeFrameOptions = { ...validOptions, image: undefined };

      // Act
      const result = await service.composeFrame(optionsWithoutImage);

      // Assert
      expect(result.framePath).toMatch(/\.png$/);
    });

    it('should compose a frame with an image URL', async () => {
      // Arrange
      const axiosMock = jest.requireMock('axios');
      axiosMock.get.mockResolvedValueOnce({ data: Buffer.from('image-bytes') });

      const optionsWithImage: IComposeFrameOptions = {
        ...validOptions,
        image: {
          url: 'https://example.com/image.png',
          width: 1024,
          height: 1024,
          format: ImageFormat.PNG,
          prompt: 'test prompt',
        },
      };

      // Act
      const result = await service.composeFrame(optionsWithImage);

      // Assert
      expect(result.framePath).toMatch(/\.png$/);
    });

    it('should fall back to gradient if image fetch fails', async () => {
      // Arrange
      const axiosMock = jest.requireMock('axios');
      axiosMock.get.mockRejectedValueOnce(new Error('Network error'));

      const optionsWithImage: IComposeFrameOptions = {
        ...validOptions,
        image: {
          url: 'https://example.com/image.png',
          width: 1024,
          height: 1024,
          format: ImageFormat.PNG,
          prompt: 'test prompt',
        },
      };

      // Act
      const result = await service.composeFrame(optionsWithImage);

      // Assert — should not throw, just use gradient fallback
      expect(result.framePath).toMatch(/\.png$/);
    });

    it('should handle all VideoStyle values for fallback backgrounds', async () => {
      // Act & Assert: no style should throw
      for (const style of Object.values(VideoStyle)) {
        const result = await service.composeFrame({ ...validOptions, style });
        expect(result.framePath).toMatch(/\.png$/);
      }
    });
  });
});
