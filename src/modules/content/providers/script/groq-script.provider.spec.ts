import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GroqScriptProvider } from './groq-script.provider';
import {
  ProviderNotConfiguredException,
  ScriptGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateScriptRequestDto } from '../../../../domain/dto/generate-script.dto';
import { VideoPlatform, VideoStyle, SceneTransition } from '../../../../domain/enums/video.enums';

jest.mock('groq-sdk', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  };
});

const GroqMock = jest.requireMock('groq-sdk');

describe('GroqScriptProvider', () => {
  let provider: GroqScriptProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockCreate: jest.Mock;

  const validRequest: GenerateScriptRequestDto = {
    topic: 'How stars are formed',
    platform: VideoPlatform.YOUTUBE,
    style: VideoStyle.CINEMATIC,
    targetDuration: 30,
  };

  const mockScriptJson = JSON.stringify({
    title: 'Star Formation',
    description: 'A cinematic journey through stellar birth.',
    scenes: [
      {
        sequenceNumber: 1,
        narration: 'Deep in a nebula, gravity pulls gas and dust together.',
        imageDescription: 'Swirling nebula in deep space, cinematic lighting, photorealistic',
        duration: 10,
        transition: 'fade',
      },
      {
        sequenceNumber: 2,
        narration: 'Pressure and heat build until nuclear fusion ignites.',
        imageDescription: 'Protostar glowing red-orange, surrounded by accretion disk',
        duration: 10,
        transition: 'dissolve',
      },
      {
        sequenceNumber: 3,
        narration: 'A new star blazes to life, illuminating its stellar nursery.',
        imageDescription: 'Bright young star bursting through nebula clouds, epic scale',
        duration: 10,
        transition: 'cut',
      },
    ],
  });

  beforeEach(async () => {
    mockCreate = GroqMock.__mockCreate;
    mockCreate.mockReset();
    GroqMock.default.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqScriptProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<GroqScriptProvider>(GroqScriptProvider);
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

  describe('generateScript', () => {
    it('should throw ProviderNotConfiguredException when API key is missing', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ProviderNotConfiguredException,
      );
    });

    it('should initialize Groq client with API key', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      await provider.generateScript(validRequest);

      const ctorCall = GroqMock.default.mock.calls[0][0] as Record<string, string>;
      expect(ctorCall.apiKey).toBe('gsk-test-key');
    });

    it('should generate a valid script successfully', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        if (key === 'providers.script.model') return 'llama-3.3-70b-versatile';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      const result = await provider.generateScript(validRequest);

      expect(result.title).toBe('Star Formation');
      expect(result.platform).toBe(VideoPlatform.YOUTUBE);
      expect(result.style).toBe(VideoStyle.CINEMATIC);
      expect(result.scenes).toHaveLength(3);
      expect(result.totalDuration).toBe(30);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should parse markdown-fenced JSON responses', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: `\`\`\`json\n${mockScriptJson}\n\`\`\`` } }],
      });

      const result = await provider.generateScript(validRequest);

      expect(result.title).toBe('Star Formation');
    });

    it('should default to FADE transition for unknown transition values', async () => {
      const scriptWithBadTransition = JSON.stringify({
        ...JSON.parse(mockScriptJson),
        scenes: [{ ...JSON.parse(mockScriptJson).scenes[0], transition: 'zoom' }],
      });

      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: scriptWithBadTransition } }],
      });

      const result = await provider.generateScript(validRequest);

      expect(result.scenes[0].transition).toBe(SceneTransition.FADE);
    });

    it('should throw ScriptGenerationException when response has no content', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should throw ScriptGenerationException when API call fails', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should default style to CARTOON when not provided in request', async () => {
      const requestWithoutStyle: GenerateScriptRequestDto = {
        topic: 'Ocean life',
        platform: VideoPlatform.INSTAGRAM_REELS,
        targetDuration: 15,
      };

      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      const result = await provider.generateScript(requestWithoutStyle);

      expect(result.style).toBe(VideoStyle.CARTOON);
    });

    it('should reuse the same Groq client on repeated calls', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.groq.apiKey') return 'gsk-test-key';
        return def;
      });
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: mockScriptJson } }],
      });

      await provider.generateScript(validRequest);
      await provider.generateScript(validRequest);

      expect(GroqMock.default).toHaveBeenCalledTimes(1);
    });
  });
});