import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IImageGenerator,
  IGeneratedImage,
} from '../../../../domain/interfaces/image-generator.interface';
import { GenerateImageRequestDto } from '../../../../domain/dto/generate-image.dto';
import { ImageFormat, ImageSize } from '../../../../domain/enums/video.enums';
import {
  ProviderNotConfiguredException,
  ImageGenerationException,
} from '../../../../common/exceptions/content-generation.exception';

const TOGETHER_BASE_URL = 'https://api.together.xyz/v1';
const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell-Free';

@Injectable()
export class TogetherImageProvider implements IImageGenerator {
  private readonly logger = new Logger(TogetherImageProvider.name);
  private client?: OpenAI;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'together-ai';
  }

  async generateImage(request: GenerateImageRequestDto): Promise<IGeneratedImage> {
    this.logger.log(`Generating image via TogetherAI: "${request.prompt.slice(0, 60)}..."`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.image.model', DEFAULT_MODEL);
    const size = request.size ?? ImageSize.SQUARE;
    const prompt = this.buildPrompt(request);
    const [width, height] = this.parseDimensions(size);

    try {
      const response = await client.images.generate({
        model,
        prompt,
        n: 1,
        // TogetherAI returns base64 by default
        response_format: 'b64_json',
        // Pass width/height as extra body params supported by Together's API
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(({ width, height } as any)),
      });

      const imageData = response.data ?? [];
      const image = imageData[0];
      if (!image?.b64_json) {
        throw new ImageGenerationException('together-ai', new Error('No image data in TogetherAI response'));
      }

      return {
        base64Data: image.b64_json,
        width,
        height,
        format: ImageFormat.PNG,
        prompt: request.prompt,
      };
    } catch (error) {
      if (error instanceof ImageGenerationException) throw error;
      this.logger.error('TogetherAI image generation failed', error);
      throw new ImageGenerationException('together-ai', error as Error);
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('providers.together.apiKey');
      if (!apiKey) {
        throw new ProviderNotConfiguredException('together-ai');
      }
      this.client = new OpenAI({ apiKey, baseURL: TOGETHER_BASE_URL });
    }
    return this.client;
  }

  private buildPrompt(request: GenerateImageRequestDto): string {
    const parts = [request.prompt];
    if (request.styleModifier) {
      parts.push(`Style: ${request.styleModifier}`);
    }
    return parts.join('. ');
  }

  private parseDimensions(size: ImageSize): [number, number] {
    const [w, h] = size.split('x').map(Number);
    return [w, h];
  }
}
