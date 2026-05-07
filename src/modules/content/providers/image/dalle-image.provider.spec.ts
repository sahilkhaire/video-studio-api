import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DALLEImageProvider } from './dalle-image.provider';
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

describe('DALLEImageProvider', () => {
  let provider: DALLEImageProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockGenerate: jest.Mock;

  const validRequest: GenerateImageRequestDto = {
    prompt: 'A bright green leaf with sunrays, cartoon style, vibrant colors',
    size: ImageSize.SQUARE,
    styleModifier: 'cartoon',
  };

  beforeEach(async () => {
    mockGenerate = OpenAIMock.__mockGenerate;
    mockGenerate.mockReset();
    OpenAIMock.default.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DALLEImageProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<DALLEImageProvider>(DALLEImageProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "dalle"', () => {
      expect(provider.getProviderName()).toBe('dalle');
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

    it('should generate an image and return correct structure', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        if (key === 'providers.image.model') return 'dall-e-3';
        return defaultVal;
      });

      mockGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/image.png', revised_prompt: 'A refined prompt' }],
      });

      // Act
      const result = await provider.generateImage(validRequest);

      // Assert
      expect(result.url).toBe('https://example.com/image.png');
      expect(result.revisedPrompt).toBe('A refined prompt');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.format).toBe(ImageFormat.PNG);
      expect(result.prompt).toBe(validRequest.prompt);
    });

    it('should use SQUARE as default size when not specified', async () => {
      // Arrange
      const requestWithoutSize: GenerateImageRequestDto = { prompt: validRequest.prompt };

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/image.png' }],
      });

      // Act
      const result = await provider.generateImage(requestWithoutSize);

      // Assert
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
    });

    it('should throw ImageGenerationException when API returns no URL', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockGenerate.mockResolvedValueOnce({ data: [{}] });

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(ImageGenerationException);
    });

    it('should throw ImageGenerationException when API call fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockGenerate.mockRejectedValueOnce(new Error('API error'));

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(ImageGenerationException);
    });

    it('should append styleModifier to the prompt', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.openai.apiKey') return 'sk-test-key';
        return defaultVal;
      });

      mockGenerate.mockResolvedValueOnce({
        data: [{ url: 'https://example.com/image.png' }],
      });

      // Act
      await provider.generateImage({ ...validRequest, styleModifier: 'watercolor' });

      // Assert
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('watercolor'),
        }),
      );
    });
  });
});
