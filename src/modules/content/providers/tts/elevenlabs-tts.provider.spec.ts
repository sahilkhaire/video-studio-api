import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsTTSProvider } from './elevenlabs-tts.provider';
import {
  ProviderNotConfiguredException,
  AudioGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateAudioRequestDto } from '../../../../domain/dto/generate-audio.dto';
import { AudioFormat } from '../../../../domain/enums/video.enums';

jest.mock('axios');
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

describe('ElevenLabsTTSProvider', () => {
  let provider: ElevenLabsTTSProvider;
  let configService: jest.Mocked<ConfigService>;

  const validRequest: GenerateAudioRequestDto = {
    text: 'Plants absorb sunlight through their leaves and convert it to energy.',
    outputPath: '/tmp/audio-test.mp3',
    speed: 1.0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElevenLabsTTSProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<ElevenLabsTTSProvider>(ElevenLabsTTSProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "elevenlabs"', () => {
      expect(provider.getProviderName()).toBe('elevenlabs');
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

    it('should generate audio and return correct metadata', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.elevenlabs.apiKey') return 'el_test_key';
        return defaultVal;
      });

      const fakeBuffer = Buffer.from('fake-mp3-bytes');
      axios.post.mockResolvedValueOnce({ data: fakeBuffer.buffer });

      // Act
      const result = await provider.generateAudio(validRequest);

      // Assert
      expect(result.filePath).toBe('/tmp/audio-test.mp3');
      expect(result.format).toBe(AudioFormat.MP3);
      expect(result.sampleRate).toBe(44100);
      expect(result.text).toBe(validRequest.text);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should send request to ElevenLabs API with correct headers', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.elevenlabs.apiKey') return 'el_test_key';
        return defaultVal;
      });

      const fakeBuffer = Buffer.from('fake-mp3-bytes');
      axios.post.mockResolvedValueOnce({ data: fakeBuffer.buffer });

      // Act
      await provider.generateAudio(validRequest);

      // Assert
      const [url, , config] = axios.post.mock.calls[0] as [
        string,
        unknown,
        { headers: Record<string, string> },
      ];
      expect(url).toContain('elevenlabs.io');
      expect(config.headers['xi-api-key']).toBe('el_test_key');
      expect(config.headers['Accept']).toBe('audio/mpeg');
    });

    it('should use provided voice ID in the request URL', async () => {
      // Arrange
      const requestWithVoice: GenerateAudioRequestDto = {
        ...validRequest,
        voice: 'custom-voice-id-xyz',
      };

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.elevenlabs.apiKey') return 'el_test_key';
        return defaultVal;
      });

      const fakeBuffer = Buffer.from('fake-mp3-bytes');
      axios.post.mockResolvedValueOnce({ data: fakeBuffer.buffer });

      // Act
      await provider.generateAudio(requestWithVoice);

      // Assert
      const [url] = axios.post.mock.calls[0] as [string];
      expect(url).toContain('custom-voice-id-xyz');
    });

    it('should estimate duration based on word count', async () => {
      // Arrange — 10 words at 2.5 words/sec = 4 seconds
      const shortRequest: GenerateAudioRequestDto = {
        text: 'one two three four five six seven eight nine ten',
        outputPath: '/tmp/short.mp3',
        speed: 1.0,
      };

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.elevenlabs.apiKey') return 'el_test_key';
        return defaultVal;
      });

      const fakeBuffer = Buffer.from('fake-mp3-bytes');
      axios.post.mockResolvedValueOnce({ data: fakeBuffer.buffer });

      // Act
      const result = await provider.generateAudio(shortRequest);

      // Assert — 10 words / 2.5 wps = 4.0 seconds
      expect(result.duration).toBeCloseTo(4.0, 1);
    });

    it('should throw AudioGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.elevenlabs.apiKey') return 'el_test_key';
        return defaultVal;
      });

      axios.post.mockRejectedValueOnce(new Error('API quota exceeded'));

      // Act & Assert
      await expect(provider.generateAudio(validRequest)).rejects.toThrow(AudioGenerationException);
    });

    it('should generate a temp output path when none is provided', async () => {
      // Arrange
      const requestWithoutPath: GenerateAudioRequestDto = {
        text: 'Hello world',
        speed: 1.0,
      };

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.elevenlabs.apiKey') return 'el_test_key';
        if (key === 'video.storage.tempPath') return '/tmp/video-studio';
        return defaultVal;
      });

      const fakeBuffer = Buffer.from('fake-mp3-bytes');
      axios.post.mockResolvedValueOnce({ data: fakeBuffer.buffer });

      // Act
      const result = await provider.generateAudio(requestWithoutPath);

      // Assert
      expect(result.filePath).toContain('/tmp/video-studio');
      expect(result.filePath).toMatch(/\.mp3$/);
    });
  });
});
