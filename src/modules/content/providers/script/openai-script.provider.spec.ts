import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIScriptProvider } from './openai-script.provider';
import {
  ProviderNotConfiguredException,
  ScriptGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateScriptRequestDto } from '../../../../domain/dto/generate-script.dto';
import { VideoPlatform, VideoStyle, SceneTransition } from '../../../../domain/enums/video.enums';

// Mock the openai module so no real API calls are made
jest.mock('openai', () => {
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

const OpenAIMock = jest.requireMock('openai');

describe('OpenAIScriptProvider', () => {
  let provider: OpenAIScriptProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockCreate: jest.Mock;

  const validRequest: GenerateScriptRequestDto = {
    topic: 'How photosynthesis works in plants',
    platform: VideoPlatform.YOUTUBE,
    style: VideoStyle.CARTOON,
    targetDuration: 30,
  };

  const mockScriptJson = JSON.stringify({
    title: 'How Photosynthesis Works',
    description: 'A short cartoon explaining photosynthesis.',
    scenes: [
      {
        sequenceNumber: 1,
        narration: 'Plants absorb sunlight through their leaves.',
        imageDescription: 'A bright green leaf with sunrays hitting its surface, cartoon style',
        duration: 10,
        transition: 'fade',
      },
      {
        sequenceNumber: 2,
        narration: 'Carbon dioxide and water are converted to glucose.',
        imageDescription: 'Chemical equation visualization, cartoon style, colorful arrows',
        duration: 10,
        transition: 'dissolve',
      },
      {
        sequenceNumber: 3,
        narration: 'Oxygen is released as a byproduct.',
        imageDescription: 'Oxygen bubbles floating up from a plant leaf, cartoon style',
        duration: 10,
        transition: 'fade',
      },
    ],
  });

  beforeEach(async () => {
    // Reset mock before each test
    mockCreate = OpenAIMock.__mockCreate;
    mockCreate.mockReset();
    OpenAIMock.default.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIScriptProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<OpenAIScriptProvider>(OpenAIScriptProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "openai"', () => {
      // Act
      const name = provider.getProviderName();

      // Assert
      expect(name).toBe('openai');
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

    it('should generate a valid script successfully', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        if (key === 'providers.script.model') return 'gpt-4o';
        return defaultVal;
      });

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      expect(result.title).toBe('How Photosynthesis Works');
      expect(result.platform).toBe(VideoPlatform.YOUTUBE);
      expect(result.style).toBe(VideoStyle.CARTOON);
      expect(result.scenes).toHaveLength(3);
      expect(result.totalDuration).toBe(30);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should assign a uuid to each scene', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
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

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: scriptWithBadTransition } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      expect(result.scenes[0].transition).toBe(SceneTransition.FADE);
    });

    it('should throw ScriptGenerationException when API returns empty content', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should throw ScriptGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should use default style CARTOON when style is not provided', async () => {
      // Arrange
      const requestWithoutStyle: GenerateScriptRequestDto = {
        topic: 'How photosynthesis works in plants',
        platform: VideoPlatform.INSTAGRAM_REELS,
        targetDuration: 30,
      };

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      const result = await provider.generateScript(requestWithoutStyle);

      // Assert
      expect(result.style).toBe(VideoStyle.CARTOON);
    });
  });
});
