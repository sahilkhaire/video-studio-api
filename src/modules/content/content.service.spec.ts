import { Test, TestingModule } from '@nestjs/testing';
import { ContentService, IGeneratedContent } from './content.service';
import { SCRIPT_GENERATOR, IMAGE_GENERATOR, TTS_PROVIDER } from './constants/injection-tokens';
import { IScriptGenerator, IVideoScript } from '../../domain/interfaces/script-generator.interface';
import {
  IImageGenerator,
  IGeneratedImage,
} from '../../domain/interfaces/image-generator.interface';
import { ITTSProvider, IGeneratedAudio } from '../../domain/interfaces/tts-provider.interface';
import { GenerateScriptRequestDto } from '../../domain/dto/generate-script.dto';
import {
  VideoPlatform,
  VideoStyle,
  SceneTransition,
  ImageFormat,
  AudioFormat,
  ImageSize,
} from '../../domain/enums/video.enums';

const buildMockScript = (): IVideoScript => ({
  title: 'Test Video',
  description: 'A test video script',
  platform: VideoPlatform.YOUTUBE,
  style: VideoStyle.CARTOON,
  scenes: [
    {
      id: 'scene-1',
      sequenceNumber: 1,
      narration: 'Scene one narration text here.',
      imageDescription: 'A colorful cartoon scene',
      duration: 10,
      transition: SceneTransition.FADE,
    },
    {
      id: 'scene-2',
      sequenceNumber: 2,
      narration: 'Scene two narration text here.',
      imageDescription: 'Another colorful cartoon scene',
      duration: 10,
      transition: SceneTransition.CUT,
    },
  ],
  totalDuration: 20,
  generatedAt: new Date(),
});

const buildMockImage = (): IGeneratedImage => ({
  url: 'https://example.com/image.png',
  width: 1024,
  height: 1024,
  format: ImageFormat.PNG,
  prompt: 'A colorful cartoon scene',
});

const buildMockAudio = (): IGeneratedAudio => ({
  filePath: '/tmp/audio/test.mp3',
  duration: 4,
  format: AudioFormat.MP3,
  sampleRate: 24000,
  text: 'Scene narration text.',
});

describe('ContentService', () => {
  let service: ContentService;
  let mockScriptGenerator: jest.Mocked<IScriptGenerator>;
  let mockImageGenerator: jest.Mocked<IImageGenerator>;
  let mockTtsProvider: jest.Mocked<ITTSProvider>;

  beforeEach(async () => {
    mockScriptGenerator = {
      generateScript: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('openai'),
    };

    mockImageGenerator = {
      generateImage: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('dalle'),
    };

    mockTtsProvider = {
      generateAudio: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('openai'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: SCRIPT_GENERATOR, useValue: mockScriptGenerator },
        { provide: IMAGE_GENERATOR, useValue: mockImageGenerator },
        { provide: TTS_PROVIDER, useValue: mockTtsProvider },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveProviders', () => {
    it('should return the names of all active providers', () => {
      // Act
      const providers = service.getActiveProviders();

      // Assert
      expect(providers).toEqual({ script: 'openai', image: 'dalle', tts: 'openai' });
    });
  });

  describe('generateScript', () => {
    it('should delegate to scriptGenerator', async () => {
      // Arrange
      const request: GenerateScriptRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 30,
      };
      const mockScript = buildMockScript();
      mockScriptGenerator.generateScript.mockResolvedValueOnce(mockScript);

      // Act
      const result = await service.generateScript(request);

      // Assert
      expect(result).toBe(mockScript);
      expect(mockScriptGenerator.generateScript).toHaveBeenCalledWith(request);
    });
  });

  describe('generateImage', () => {
    it('should delegate to imageGenerator', async () => {
      // Arrange
      const request = { prompt: 'A cartoon forest scene', size: ImageSize.SQUARE };
      const mockImage = buildMockImage();
      mockImageGenerator.generateImage.mockResolvedValueOnce(mockImage);

      // Act
      const result = await service.generateImage(request);

      // Assert
      expect(result).toBe(mockImage);
      expect(mockImageGenerator.generateImage).toHaveBeenCalledWith(request);
    });
  });

  describe('generateVideoContent', () => {
    it('should orchestrate script, image, and audio generation', async () => {
      // Arrange
      const request: GenerateScriptRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 20,
      };
      const mockScript = buildMockScript();
      const mockImage = buildMockImage();
      const mockAudio = buildMockAudio();

      mockScriptGenerator.generateScript.mockResolvedValueOnce(mockScript);
      mockImageGenerator.generateImage.mockResolvedValue(mockImage);
      mockTtsProvider.generateAudio.mockResolvedValue(mockAudio);

      // Act
      const result: IGeneratedContent = await service.generateVideoContent(request);

      // Assert
      expect(result.script).toBe(mockScript);
      expect(result.sceneAssets).toHaveLength(2);
      expect(result.scriptProvider).toBe('openai');
      expect(result.imageProvider).toBe('dalle');
      expect(result.audioProvider).toBe('openai');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should generate image and audio for each scene', async () => {
      // Arrange
      const request: GenerateScriptRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 20,
      };
      mockScriptGenerator.generateScript.mockResolvedValueOnce(buildMockScript());
      mockImageGenerator.generateImage.mockResolvedValue(buildMockImage());
      mockTtsProvider.generateAudio.mockResolvedValue(buildMockAudio());

      // Act
      await service.generateVideoContent(request);

      // Assert
      expect(mockImageGenerator.generateImage).toHaveBeenCalledTimes(2);
      expect(mockTtsProvider.generateAudio).toHaveBeenCalledTimes(2);
    });

    it('should capture image failure without failing entire job', async () => {
      // Arrange
      const request: GenerateScriptRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 20,
      };
      mockScriptGenerator.generateScript.mockResolvedValueOnce(buildMockScript());
      mockImageGenerator.generateImage.mockRejectedValue(new Error('Image API down'));
      mockTtsProvider.generateAudio.mockResolvedValue(buildMockAudio());

      // Act
      const result = await service.generateVideoContent(request);

      // Assert
      result.sceneAssets.forEach((asset) => {
        expect(asset.imageFailed).toBe(true);
        expect(asset.image).toBeUndefined();
        expect(asset.audio).toBeDefined();
      });
    });

    it('should capture audio failure without failing entire job', async () => {
      // Arrange
      const request: GenerateScriptRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 20,
      };
      mockScriptGenerator.generateScript.mockResolvedValueOnce(buildMockScript());
      mockImageGenerator.generateImage.mockResolvedValue(buildMockImage());
      mockTtsProvider.generateAudio.mockRejectedValue(new Error('TTS API down'));

      // Act
      const result = await service.generateVideoContent(request);

      // Assert
      result.sceneAssets.forEach((asset) => {
        expect(asset.audioFailed).toBe(true);
        expect(asset.audio).toBeUndefined();
        expect(asset.image).toBeDefined();
      });
    });
  });
});
