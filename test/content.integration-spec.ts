import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ContentService } from './../src/modules/content/content.service';
import { CacheKeyService } from './../src/modules/cache/cache-key.service';
import { ContentCacheService } from './../src/modules/cache/content-cache.service';
import { CostTrackingService } from './../src/modules/cost/cost-tracking.service';
import {
  SCRIPT_GENERATOR,
  IMAGE_GENERATOR,
  TTS_PROVIDER,
} from './../src/modules/content/constants/injection-tokens';
import {
  IScriptGenerator,
  IVideoScript,
} from './../src/domain/interfaces/script-generator.interface';
import {
  IImageGenerator,
  IGeneratedImage,
} from './../src/domain/interfaces/image-generator.interface';
import { ITTSProvider, IGeneratedAudio } from './../src/domain/interfaces/tts-provider.interface';
import {
  VideoPlatform,
  VideoStyle,
  SceneTransition,
  ImageFormat,
  AudioFormat,
} from './../src/domain/enums/video.enums';
import { ContentType } from './../src/domain/interfaces/cost-tracking.interface';

const buildScript = (): IVideoScript => ({
  title: 'Integration Test Video',
  description: 'Integration test script',
  platform: VideoPlatform.YOUTUBE,
  style: VideoStyle.CINEMATIC,
  scenes: [
    {
      id: 'scene-1',
      sequenceNumber: 1,
      narration: 'Narration for scene one.',
      imageDescription: 'A bright sunny sky',
      duration: 10,
      transition: SceneTransition.FADE,
    },
  ],
  totalDuration: 10,
  generatedAt: new Date(),
});

const buildImage = (): IGeneratedImage => ({
  url: 'https://example.com/img.png',
  width: 1024,
  height: 1024,
  format: ImageFormat.PNG,
  prompt: 'A bright sunny sky',
});

const buildAudio = (): IGeneratedAudio => ({
  filePath: '/tmp/audio.mp3',
  duration: 3,
  format: AudioFormat.MP3,
  sampleRate: 24000,
  text: 'Narration for scene one.',
});

describe('ContentService Integration', () => {
  let service: ContentService;
  let cacheKeyService: CacheKeyService;
  let costTrackingService: CostTrackingService;

  let mockScriptGenerator: jest.Mocked<IScriptGenerator>;
  let mockImageGenerator: jest.Mocked<IImageGenerator>;
  let mockTtsProvider: jest.Mocked<ITTSProvider>;

  // In-memory cache to simulate Redis
  const store = new Map<string, string>();
  const mockCacheService = {
    get: jest.fn(async (key: string) => {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : null;
    }),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };

  beforeEach(async () => {
    store.clear();
    jest.clearAllMocks();

    mockScriptGenerator = {
      generateScript: jest.fn().mockResolvedValue(buildScript()),
      getProviderName: jest.fn().mockReturnValue('openai'),
    };
    mockImageGenerator = {
      generateImage: jest.fn().mockResolvedValue(buildImage()),
      getProviderName: jest.fn().mockReturnValue('dalle'),
    };
    mockTtsProvider = {
      generateAudio: jest.fn().mockResolvedValue(buildAudio()),
      getVoices: jest.fn().mockResolvedValue([]),
      getProviderName: jest.fn().mockReturnValue('openai'),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        ContentService,
        CacheKeyService,
        CostTrackingService,
        { provide: SCRIPT_GENERATOR, useValue: mockScriptGenerator },
        { provide: IMAGE_GENERATOR, useValue: mockImageGenerator },
        { provide: TTS_PROVIDER, useValue: mockTtsProvider },
        { provide: ContentCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
    cacheKeyService = module.get<CacheKeyService>(CacheKeyService);
    costTrackingService = module.get<CostTrackingService>(CostTrackingService);
  });

  describe('cache miss → provider call → cache populate', () => {
    it('calls provider on first request and stores in cache', async () => {
      // Act
      const result = await service.generateScript({
        topic: 'Space exploration',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 30,
      });

      // Assert
      expect(mockScriptGenerator.generateScript).toHaveBeenCalledTimes(1);
      expect(result.title).toBe('Integration Test Video');

      const cacheKey = cacheKeyService.forScript({
        topic: 'Space exploration',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 30,
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(cacheKey, result, expect.any(Number));
    });
  });

  describe('cache hit → skip provider call', () => {
    it('returns cached value without calling provider on second request', async () => {
      // Arrange — warm cache on first call
      const req = { topic: 'Solar system', platform: VideoPlatform.YOUTUBE, targetDuration: 30 };
      await service.generateScript(req);
      mockScriptGenerator.generateScript.mockClear();

      // Act — second call should hit cache
      const result = await service.generateScript(req);

      // Assert
      expect(mockScriptGenerator.generateScript).not.toHaveBeenCalled();
      expect(result.title).toBe('Integration Test Video');
    });
  });

  describe('cost tracking with cache', () => {
    it('records cost on provider call (cache miss)', async () => {
      // Act
      await service.generateScript({
        topic: 'Quantum physics',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 30,
      });

      // Assert
      const summary = costTrackingService.getSummary();
      expect(summary.totalCalls).toBe(1);
      expect(summary.byProvider[0].contentType).toBe(ContentType.SCRIPT);
      expect(summary.byProvider[0].provider).toBe('openai');
    });

    it('does NOT record cost on cache hit', async () => {
      // Arrange — warm cache
      const req = { topic: 'Black holes', platform: VideoPlatform.YOUTUBE, targetDuration: 30 };
      await service.generateScript(req);
      costTrackingService.reset();

      // Act — second call hits cache
      await service.generateScript(req);

      // Assert — no new cost recorded
      expect(costTrackingService.getSummary().totalCalls).toBe(0);
    });
  });

  describe('generateVideoContent integration', () => {
    it('orchestrates script + image + audio for all scenes', async () => {
      // Act
      const result = await service.generateVideoContent({
        topic: 'Mars colonisation',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 30,
      });

      // Assert
      expect(result.script.title).toBe('Integration Test Video');
      expect(result.sceneAssets).toHaveLength(1);
      expect(result.sceneAssets[0].image).toBeDefined();
      expect(result.sceneAssets[0].audio).toBeDefined();
      expect(result.scriptProvider).toBe('openai');
      expect(result.imageProvider).toBe('dalle');
      expect(result.audioProvider).toBe('openai');
    });

    it('image failure does not abort the job', async () => {
      // Arrange
      mockImageGenerator.generateImage.mockRejectedValue(new Error('API down'));

      // Act
      const result = await service.generateVideoContent({
        topic: 'Failure test',
        platform: VideoPlatform.INSTAGRAM_REELS,
        targetDuration: 15,
      });

      // Assert
      expect(result.sceneAssets[0].imageFailed).toBe(true);
      expect(result.sceneAssets[0].audio).toBeDefined();
    });
  });
});
