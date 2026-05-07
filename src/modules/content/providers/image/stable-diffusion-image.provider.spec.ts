import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StableDiffusionImageProvider } from './stable-diffusion-image.provider';
import {
  ProviderNotConfiguredException,
  ImageGenerationException,
} from '../../../../common/exceptions/content-generation.exception';
import { GenerateImageRequestDto } from '../../../../domain/dto/generate-image.dto';
import { ImageFormat, ImageSize } from '../../../../domain/enums/video.enums';

// Mock axios so no real HTTP calls are made
jest.mock('axios');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');

describe('StableDiffusionImageProvider', () => {
  let provider: StableDiffusionImageProvider;
  let configService: jest.Mocked<ConfigService>;

  const validRequest: GenerateImageRequestDto = {
    prompt: 'A futuristic cityscape at night, neon lights reflecting on wet pavement',
    size: ImageSize.LANDSCAPE,
    styleModifier: 'cinematic',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StableDiffusionImageProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get<StableDiffusionImageProvider>(StableDiffusionImageProvider);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('getProviderName', () => {
    it('should return "stable-diffusion"', () => {
      expect(provider.getProviderName()).toBe('stable-diffusion');
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

    it('should generate an image successfully after polling', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.replicate.apiKey') return 'r8_test_key';
        return defaultVal;
      });

      // First call: create prediction
      axios.post.mockResolvedValueOnce({ data: { id: 'pred-123', status: 'starting' } });

      // Second call: poll → succeeded
      axios.get.mockResolvedValueOnce({
        data: {
          id: 'pred-123',
          status: 'succeeded',
          output: ['https://cdn.replicate.com/image.png'],
        },
      });

      // Act
      const result = await provider.generateImage(validRequest);

      // Assert
      expect(result.url).toBe('https://cdn.replicate.com/image.png');
      expect(result.format).toBe(ImageFormat.PNG);
      expect(result.prompt).toBe(validRequest.prompt);
      expect(result.width).toBe(1792);
      expect(result.height).toBe(1024);
    });

    it('should poll multiple times until succeeded', async () => {
      // Arrange — use fake timers so sleep(2000) resolves instantly
      jest.useFakeTimers();

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.replicate.apiKey') return 'r8_test_key';
        return defaultVal;
      });

      axios.post.mockResolvedValueOnce({ data: { id: 'pred-456', status: 'starting' } });

      // First two polls: processing, third: succeeded
      axios.get
        .mockResolvedValueOnce({ data: { id: 'pred-456', status: 'processing' } })
        .mockResolvedValueOnce({ data: { id: 'pred-456', status: 'processing' } })
        .mockResolvedValueOnce({
          data: {
            id: 'pred-456',
            status: 'succeeded',
            output: ['https://cdn.replicate.com/final.png'],
          },
        });

      // Act — run timers between each microtask flush so sleeps resolve
      const promise = provider.generateImage(validRequest);
      await jest.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(axios.get).toHaveBeenCalledTimes(3);
      expect(result.url).toBe('https://cdn.replicate.com/final.png');

      jest.useRealTimers();
    });

    it('should throw ImageGenerationException when prediction fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.replicate.apiKey') return 'r8_test_key';
        return defaultVal;
      });

      axios.post.mockResolvedValueOnce({ data: { id: 'pred-789', status: 'starting' } });
      axios.get.mockResolvedValueOnce({
        data: { id: 'pred-789', status: 'failed', error: 'Out of memory' },
      });

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(ImageGenerationException);
    });

    it('should throw ImageGenerationException when HTTP request fails', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.replicate.apiKey') return 'r8_test_key';
        return defaultVal;
      });

      axios.post.mockRejectedValueOnce(new Error('Network timeout'));

      // Act & Assert
      await expect(provider.generateImage(validRequest)).rejects.toThrow(ImageGenerationException);
    });

    it('should use default SQUARE size when size is not specified', async () => {
      // Arrange
      const requestWithoutSize: GenerateImageRequestDto = {
        prompt: 'A simple landscape',
      };

      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.replicate.apiKey') return 'r8_test_key';
        return defaultVal;
      });

      axios.post.mockResolvedValueOnce({ data: { id: 'pred-sq', status: 'starting' } });
      axios.get.mockResolvedValueOnce({
        data: { id: 'pred-sq', status: 'succeeded', output: ['https://cdn.replicate.com/sq.png'] },
      });

      // Act
      const result = await provider.generateImage(requestWithoutSize);

      // Assert
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
    });

    it('should append styleModifier to prompt', async () => {
      // Arrange
      (configService.get as jest.Mock).mockImplementation((key: string, defaultVal?: string) => {
        if (key === 'providers.replicate.apiKey') return 'r8_test_key';
        return defaultVal;
      });

      axios.post.mockResolvedValueOnce({ data: { id: 'pred-style', status: 'starting' } });
      axios.get.mockResolvedValueOnce({
        data: {
          id: 'pred-style',
          status: 'succeeded',
          output: ['https://cdn.replicate.com/styled.png'],
        },
      });

      // Act
      await provider.generateImage(validRequest);

      // Assert — the prompt posted should include styleModifier
      const postedBody = axios.post.mock.calls[0][1] as { input: { prompt: string } };
      expect(postedBody.input.prompt).toContain('cinematic');
    });
  });
});
