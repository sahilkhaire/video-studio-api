import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { GroqTTSProvider } from './groq-tts.provider';
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

jest.mock('groq-sdk', () => {
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

const GroqMock = jest.requireMock('groq-sdk');

describe('GroqTTSProvider', () => {
  let provider: GroqTTSProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockSpeechCreate: jest.Mock;
  let mockWriteFile: jest.Mock;

  const validRequest: GenerateAudioRequestDto = {
    text: 'Plants absorb sunlight through their leaves to produce energy.',
    voice: 'Fritz-PlayAI',
    speed: 1.0,
  };

  beforeEach(async () => {
    mockSpeechCreate = GroqMock.__mockCreate;
    mockSpeechCreate.mockReset();
    GroqMock.default.mockClear();

    mockWriteFile = fs.writeFile as jest.Mock;
    mockWriteFile.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqTTSProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<GroqTTSProvider>(GroqTTSProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "groq"', () => {
      expect(provider.getProviderName()).toBe('groq');
    });
  });

  describe('generateAudio', () => {
    it('should throw ProviderNotConfiguredException when API key is missing', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(provider.generateAudio(validRequest)).rejects.toThrow(
        ProviderNotConfiguredException,
      );
    });

    it('should generate audio and return correct structure', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        if (key === 'video.storage.tempPath') return '/tmp/test';
        return defaultVal;
      });

      const mockArrayBuffer = new ArrayBuffer(1024);
      mockSpeechCreate.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      });

      const result = await provider.generateAudio(validRequest);

      expect(result.filePath).toMatch(/\.mp3$/);
      expect(result.format).toBe(AudioFormat.MP3);
      expect(result.sampleRate).toBe(24000);
      expect(result.text).toBe(validRequest.text);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should use provided outputPath when specified', async () => {
      const customPath = '/custom/path/audio.mp3';
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return defaultVal;
      });

      mockSpeechCreate.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(512)),
      });

      const result = await provider.generateAudio({ ...validRequest, outputPath: customPath });

      expect(result.filePath).toBe(customPath);
    });

    it('should throw AudioGenerationException when API call fails', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return defaultVal;
      });

      mockSpeechCreate.mockRejectedValueOnce(new Error('API error'));

      await expect(provider.generateAudio(validRequest)).rejects.toThrow(AudioGenerationException);
    });

    it('should estimate duration based on word count', async () => {
      const tenWordText = 'one two three four five six seven eight nine ten';
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        if (key === 'video.storage.tempPath') return '/tmp/test';
        return defaultVal;
      });

      mockSpeechCreate.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(512)),
      });

      const result = await provider.generateAudio({ text: tenWordText });

      expect(result.duration).toBeCloseTo(4, 1);
    });

    it('should reuse the same Groq client on repeated calls', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return defaultVal;
      });
      mockSpeechCreate.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(512)),
      });

      await provider.generateAudio(validRequest);
      await provider.generateAudio(validRequest);

      expect(GroqMock.default).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVoices', () => {
    it('should return built-in Groq voice list', async () => {
      const voices = await provider.getVoices();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices.some((v) => v.id === 'Fritz-PlayAI')).toBe(true);
    });
  });
});