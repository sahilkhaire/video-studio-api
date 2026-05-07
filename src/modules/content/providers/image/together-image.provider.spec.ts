import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TogetherImageProvider } from './together-image.provider';
import {
  ProviderNotConfiguredException,
  ImageGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateImageRequestDto } from '../../../../domain/dto/generate-image.dto';
import { ImageFormat, ImageSize } from '../../../../domain/enums/video.enums';

jest.mock('openai', () => {
  const mockGenerate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      images: { generate: mockGenerate },
    })),
    __mockGenerate: mockGenerate,
  };
});

const OpenAIMock = jest.requireMock('openai');

describe('TogetherImageProvider', () => {
  let provider: TogetherImageProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockGenerate: jest.Mock;

  const validRequest: GenerateImageRequestDto = {
    prompt: 'A mountain landscape at sunset, cinematic photography',
    size: ImageSize.SQUARE,
  };

  beforeEach(async () => {
    mockGenerate = OpenAIMock.__mockGenerate;
    mockGenerate.mockReset();
    OpenAIMock.default.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TogetherImageProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<TogetherImageProvider>(TogetherImageProvider);
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

  describe('generateImage', () => {
    it('should throw ProviderNotConfiguredException when API key is missing', async () => {
      // Arrange
      (configService.get as jest.Mock).mockReturnValue(undefined);

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(
        ProviderNotConfiguredException,
      );
    });

    it('should initialise OpenAI client with TogetherAI baseURL', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValueOnce({
        data: [{ b64_json: 'base64imagedata==' }],
      });

      // Act
      await provider.generateImage(validRequest);

      // Assert
      const ctorCall = OpenAIMock.default.mock.calls[0][0] as Record<string, string>;
      expect(ctorCall.baseURL).toBe('https://api.together.xyz/v1');
      expect(ctorCall.apiKey).toBe('test-together-key');
    });

    it('should return base64Data from the TogetherAI response', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValueOnce({
        data: [{ b64_json: 'base64imagedata==' }],
      });

      // Act
      const result = await provider.generateImage(validRequest);

      // Assert
      expect(result.base64Data).toBe('base64imagedata==');
      expect(result.format).toBe(ImageFormat.PNG);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.prompt).toBe(validRequest.prompt);
    });

    it('should use response_format b64_json in the API call', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValueOnce({
        data: [{ b64_json: 'data==' }],
      });

      // Act
      await provider.generateImage(validRequest);

      // Assert
      const callArgs = mockGenerate.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.response_format).toBe('b64_json');
    });

    it('should include styleModifier in the prompt when provided', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValueOnce({
        data: [{ b64_json: 'data==' }],
      });
      const requestWithStyle: GenerateImageRequestDto = {
        ...validRequest,
        styleModifier: 'oil painting',
      };

      // Act
      await provider.generateImage(requestWithStyle);

      // Assert
      const callArgs = mockGenerate.mock.calls[0][0] as Record<string, string>;
      expect(callArgs.prompt).toContain('oil painting');
    });

    it('should default size to SQUARE (1024x1024) when not specified', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValueOnce({
        data: [{ b64_json: 'data==' }],
      });
      const requestWithoutSize: GenerateImageRequestDto = { prompt: 'A cat' };

      // Act
      const result = await provider.generateImage(requestWithoutSize);

      // Assert
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
    });

    it('should throw ImageGenerationException when response has no b64_json', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValueOnce({ data: [{}] });

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(
        ImageGenerationException,
      );
    });

    it('should throw ImageGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockRejectedValueOnce(new Error('Model unavailable'));

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(
        ImageGenerationException,
      );
    });

    it('should reuse the same OpenAI client on repeated calls', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, def?: string) => {
        if (key === 'providers.together.apiKey') return 'test-together-key';
        return def;
      });
      mockGenerate.mockResolvedValue({ data: [{ b64_json: 'data==' }] });

      // Act
      await provider.generateImage(validRequest);
      await provider.generateImage(validRequest);

      // Assert — constructor called only once
      expect(OpenAIMock.default).toHaveBeenCalledTimes(1);
    });
  });
});
