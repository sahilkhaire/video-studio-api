import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OllamaScriptProvider } from './ollama-script.provider';
import { ScriptGenerationException } from '../../../../common/exceptions/content-generation.exception';
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

describe('OllamaScriptProvider', () => {
  let provider: OllamaScriptProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockCreate: jest.Mock;

  const validRequest: GenerateScriptRequestDto = {
    topic: 'The history of the internet',
    platform: VideoPlatform.TIKTOK,
    style: VideoStyle.MINIMAL,
    targetDuration: 60,
  };

  const mockScriptJson = JSON.stringify({
    title: 'History of the Internet',
    description: 'A quick timeline of the internet.',
    scenes: [
      {
        sequenceNumber: 1,
        narration: 'In 1969 ARPANET connected the first computers.',
        imageDescription: 'Old mainframe computers connected by lines, retro style',
        duration: 20,
        transition: 'cut',
      },
      {
        sequenceNumber: 2,
        narration: 'Tim Berners-Lee invented the World Wide Web in 1989.',
        imageDescription: 'A person typing at a computer, early 90s office, minimal style',
        duration: 20,
        transition: 'fade',
      },
      {
        sequenceNumber: 3,
        narration: 'Today the internet connects billions of devices worldwide.',
        imageDescription: 'Global network visualization, glowing nodes across a world map',
        duration: 20,
        transition: 'dissolve',
      },
    ],
  });

  beforeEach(async () => {
    mockCreate = OpenAIMock.__mockCreate;
    mockCreate.mockReset();
    OpenAIMock.default.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaScriptProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<OllamaScriptProvider>(OllamaScriptProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "ollama"', () => {
      expect(provider.getProviderName()).toBe('ollama');
    });
  });

  describe('generateScript', () => {
    it('should generate a valid script when Ollama responds correctly', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'OLLAMA_BASE_URL') return 'http://localhost:11434/v1';
        if (key === 'providers.script.model') return 'llama3.2';
        return defaultVal;
      });

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      expect(result.title).toBe('History of the Internet');
      expect(result.platform).toBe(VideoPlatform.TIKTOK);
      expect(result.style).toBe(VideoStyle.MINIMAL);
      expect(result.scenes).toHaveLength(3);
      expect(result.totalDuration).toBe(60);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should use default Ollama base URL when not configured', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: mockScriptJson } }],
      });

      // Act
      await provider.generateScript(validRequest);

      // Assert — OpenAI client should have been constructed once
      expect(OpenAIMock.default).toHaveBeenCalledWith(
        expect.objectContaining({ baseURL: 'http://localhost:11434/v1' }),
      );
    });

    it('should assign a uuid to each scene', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

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

    it('should default to FADE transition for unrecognised transition values', async () => {
      // Arrange
      const scriptWithBadTransition = JSON.stringify({
        ...JSON.parse(mockScriptJson),
        scenes: [{ ...JSON.parse(mockScriptJson).scenes[0], transition: 'spin' }],
      });

      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: scriptWithBadTransition } }],
      });

      // Act
      const result = await provider.generateScript(validRequest);

      // Assert
      expect(result.scenes[0].transition).toBe(SceneTransition.FADE);
    });

    it('should throw ScriptGenerationException when response content is null', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should throw ScriptGenerationException when no JSON found in response', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'I cannot generate that content.' } }],
      });

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should throw ScriptGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

      mockCreate.mockRejectedValueOnce(new Error('Connection refused'));

      // Act & Assert
      await expect(provider.generateScript(validRequest)).rejects.toThrow(
        ScriptGenerationException,
      );
    });

    it('should default to CARTOON style when not provided', async () => {
      // Arrange
      const requestWithoutStyle: GenerateScriptRequestDto = {
        topic: 'Space exploration',
        platform: VideoPlatform.YOUTUBE,
        targetDuration: 60,
      };

      (configService.get as jest.Mock).mockImplementation(
        (_key: string, defaultVal?: string) => defaultVal,
      );

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
