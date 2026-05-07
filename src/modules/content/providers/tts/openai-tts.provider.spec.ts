import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { OpenAITTSProvider } from './openai-tts.provider';
import {
  ProviderNotConfiguredException,
  AudioGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateAudioRequestDto } from '../../../../domain/dto/generate-audio.dto';
import { AudioFormat } from '../../../../domain/enums/video.enums';

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        speech: { create: mockCreate },
      },
    })),
    __mockCreate: mockCreate,
  };
});

const OpenAIMock = jest.requireMock('openai');

describe('OpenAITTSProvider', () => {
  let provider: OpenAITTSProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockSpeechCreate: jest.Mock;
  let mockWriteFile: jest.Mock;

  const validRequest: GenerateAudioRequestDto = {
    text: 'Plants absorb sunlight through their leaves to produce energy.',
    voice: 'alloy',
    speed: 1.0,
  };

  beforeEach(async () => {
    mockSpeechCreate = OpenAIMock.__mockCreate;
    mockSpeechCreate.mockReset();
    OpenAIMock.default.mockClear();

    mockWriteFile = fs.writeFile as jest.Mock;
    mockWriteFile.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAITTSProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<OpenAITTSProvider>(OpenAITTSProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "openai"', () => {
      expect(provider.getProviderName()).toBe('openai');
    });
  });

  describe('generateAudio', () => {
    it('should throw ProviderNotConfiguredException when API key is missing', async () => {
      // Arrange
      (configService.get as jest.Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(provider.generateAudio(validRequest)).rejects.toThrow(
        ProviderNotConfiguredException,
      );
    });

    it('should generate audio and return correct structure', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        if (key === 'video.storage.tempPath') return '/tmp/test';
        return defaultVal;
      });

      const mockArrayBuffer = new ArrayBuffer(1024);
      mockSpeechCreate.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      });

      // Act
      const result = await provider.generateAudio(validRequest);

      // Assert
      expect(result.filePath).toMatch(/\.mp3$/);
      expect(result.format).toBe(AudioFormat.MP3);
      expect(result.sampleRate).toBe(24000);
      expect(result.text).toBe(validRequest.text);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should use provided outputPath when specified', async () => {
      // Arrange
      const customPath = '/custom/path/audio.mp3';
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockSpeechCreate.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(512)),
      });

      // Act
      const result = await provider.generateAudio({ ...validRequest, outputPath: customPath });

      // Assert
      expect(result.filePath).toBe(customPath);
    });

    it('should throw AudioGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockSpeechCreate.mockRejectedValueOnce(new Error('API error'));

      // Act & Assert
      await expect(provider.generateAudio(validRequest)).rejects.toThrow(AudioGenerationException);
    });

    it('should estimate duration based on word count', async () => {
      // Arrange
      const tenWordText = 'one two three four five six seven eight nine ten';
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        if (key === 'video.storage.tempPath') return '/tmp/test';
        return defaultVal;
      });

      mockSpeechCreate.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(512)),
      });

      // Act
      const result = await provider.generateAudio({ text: tenWordText });

      // Assert: 10 words / 2.5 words per second = 4 seconds
      expect(result.duration).toBeCloseTo(4, 1);
    });
  });
});
