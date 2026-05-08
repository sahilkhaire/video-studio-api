import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VideoAssemblerService } from './video-assembler.service';
import { IComposedFrame } from '../../domain/interfaces/rendering.interface';
import { AudioFormat, SceneTransition } from '../../domain/enums/video.enums';

jest.mock('fluent-ffmpeg', () => {
  const mockCmd = {
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    videoFilters: jest.fn().mockReturnThis(),
    videoCodec: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    complexFilter: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function (this: unknown, event: string, cb: () => void) {
      if (event === 'end') cb();
      return this;
    }),
    run: jest.fn(),
  };
  const factory = jest.fn().mockReturnValue(mockCmd);
  (factory as unknown as { setFfmpegPath: jest.Mock }).setFfmpegPath = jest.fn();
  return factory;
});

jest.mock('ffmpeg-static', () => '/usr/bin/ffmpeg');

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024 * 1024 }),
  },
}));

describe('VideoAssemblerService', () => {
  let service: VideoAssemblerService;

  const makeFrame = (n: number): IComposedFrame => ({
    sceneId: `scene-${n}`,
    sequenceNumber: n,
    framePath: `/tmp/frames/frame-${n}.png`,
    width: 1280,
    height: 720,
    duration: 8,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoAssemblerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: string) => {
              if (key === 'video.storage.tempPath') return '/tmp/temp';
              if (key === 'video.storage.localPath') return '/tmp/storage';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VideoAssemblerService>(VideoAssemblerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assembleVideo', () => {
    it('should throw when no frames are provided', async () => {
      // Act & Assert
      await expect(service.assembleVideo({ frames: [], audioTracks: [], fps: 30 })).rejects.toThrow(
        'Cannot assemble video: no frames provided',
      );
    });

    it('should assemble video with frames and no audio', async () => {
      // Arrange
      const frames = [makeFrame(1), makeFrame(2)];

      // Act
      const result = await service.assembleVideo({ frames, audioTracks: [], fps: 30 });

      // Assert
      expect(result.videoPath).toMatch(/\.mp4$/);
      expect(result.width).toBe(1280);
      expect(result.height).toBe(720);
      // Transition overlap slightly reduces end duration from strict sum of scenes.
      expect(result.duration).toBeCloseTo(15.55, 2);
      expect(result.fps).toBe(30);
      expect(result.format).toBe('mp4');
    });

    it('should assemble video with audio tracks', async () => {
      // Arrange
      const frames = [makeFrame(1), makeFrame(2)];
      const audioTracks = [
        {
          sceneId: 'scene-1',
          sequenceNumber: 1,
          transition: SceneTransition.FADE,
          audio: {
            filePath: '/tmp/audio/scene-1.mp3',
            duration: 8,
            format: AudioFormat.MP3,
            sampleRate: 24000,
            text: 'Hello world',
          },
        },
      ];

      // Act
      const result = await service.assembleVideo({ frames, audioTracks, fps: 30 });

      // Assert
      expect(result.videoPath).toMatch(/\.mp4$/);
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should use a custom outputPath when provided', async () => {
      // Arrange
      const frames = [makeFrame(1)];
      const customPath = '/custom/output/final.mp4';

      // Act
      const result = await service.assembleVideo({
        frames,
        audioTracks: [],
        fps: 24,
        outputPath: customPath,
      });

      // Assert
      expect(result.videoPath).toBe(customPath);
    });

    it('should set fps from options', async () => {
      // Arrange
      const frames = [makeFrame(1)];

      // Act
      const result = await service.assembleVideo({ frames, audioTracks: [], fps: 24 });

      // Assert
      expect(result.fps).toBe(24);
    });
  });
});
