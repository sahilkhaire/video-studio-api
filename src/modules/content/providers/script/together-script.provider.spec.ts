import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TogetherScriptProvider } from './together-script.provider';
import {
  ProviderNotConfiguredException,
  ScriptGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateScriptRequestDto } from '../../../../domain/dto/generate-script.dto';
import { VideoPlatform, VideoStyle, SceneTransition } from '../../../../domain/enums/video.enums';

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

const OpenAIMock = jest.requireMock('openai');

describe('TogetherScriptProvider', () => {
  let provider: TogetherScriptProvider;
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
    mockCreate = OpenAIMock.__mockCreate;
    mockCreate.mockReset();
    OpenAIMock.default.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TogetherScriptProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<TogetherScriptProvider>(TogetherScriptProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "together-ai"', () => {
      expect(provider.getProviderName()).toBe('together-ai');
    });
  });

  describe('generateScript', () => {
    it('should throw ProviderNotConfiguredException when API key is missing', async () => {
      // Arrange
      (configService.get as jest.Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ProviderNotConfiguredException,
      );
    });

    it('should initialise OpenAI client with TogetherAI baseURL', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      await provider.generateScript(validRequest);

      // Assert — OpenAI constructor called with together baseURL
      const ctorCall = OpenAIMock.default.mock.calls[0][0] as Record<string, string>;
      expect(ctorCall.baseURL).toBe('https://api.together.xyz/v1');
      expect(ctorCall.apiKey).toBe('test-together-key');
    });

    it('should generate a valid script successfully', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        if (key === 'providers.script.model') return 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      expect(result.title).toBe('Star Formation');
      expect(result.platform).toBe(VideoPlatform.YOUTUBE);
      expect(result.style).toBe(VideoStyle.CINEMATIC);
      expect(result.scenes).toHaveLength(3);
      expect(result.totalDuration).toBe(30);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should assign a uuid to each scene', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      result.scenes.forEach((scene) => {
        expect(scene.id).toMatch(/^[0-9a-f-]{36}$/);
      });
    });

    it('should default to FADE transition for unknown transition values', async () => {
      // Arrange
      const scriptWithBadTransition = JSON.stringify({
        ...JSON.parse(mockScriptJson),
        scenes: [{ ...JSON.parse(mockScriptJson).scenes[0], transition: 'zoom' }],
      });

      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: scriptWithBadTransition } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      expect(result.scenes[0].transition).toBe(SceneTransition.FADE);
    });

    it('should throw ScriptGenerationException when response has no content', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should throw ScriptGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should default style to CARTOON when not provided in request', async () => {
      // Arrange
      const requestWithoutStyle: GenerateScriptRequestDto = {
        topic: 'Ocean life',
        platform: VideoPlatform.INSTAGRAM_REELS,
        targetDuration: 15,
      };

      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      const result = await provider.generateScript(requestWithoutStyle);

      // Assert
      expect(result.style).toBe(VideoStyle.CARTOON);
    });

    it('should reuse the same OpenAI client on repeated calls', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      await provider.generateScript(validRequest);
      await provider.generateScript(validRequest);

      // Assert — constructor called only once (client reused)
      expect(OpenAIMock.default).toHaveBeenCalledTimes(1);
    });
  });
});
