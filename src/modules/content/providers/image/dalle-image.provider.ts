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

@Injectable()
export class DALLEImageProvider implements IImageGenerator {
  private readonly logger = new Logger(DALLEImageProvider.name);
  private client?: OpenAI;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'dalle';
  }

  async generateImage(request: GenerateImageRequestDto): Promise<IGeneratedImage> {
    this.logger.log(`Generating image with DALL-E: "${request.prompt.slice(0, 60)}..."`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.image.model', 'dall-e-3');
    const size = request.size ?? ImageSize.SQUARE;
    const prompt = this.buildPrompt(request);

    try {
      const response = await client.images.generate({
        model,
        prompt,
        n: 1, // DALL-E 3 only supports n=1
        size: size as '1024x1024' | '1792x1024' | '1024x1792',
        response_format: 'url',
      });

      const imageData = response.data ?? [];
      const image = imageData[0];
      if (!image?.url) {
        throw new ImageGenerationException('dalle', new Error('No image URL in DALL-E response'));
      }

      const [width, height] = this.parseDimensions(size);

      return {
        url: image.url,
        revisedPrompt: image.revised_prompt,
        width,
        height,
        format: ImageFormat.PNG,
        prompt: request.prompt,
      };
    } catch (error) {
      if (error instanceof ImageGenerationException) throw error;
      this.logger.error('DALL-E image generation failed', error);
      throw new ImageGenerationException('dalle', error as Error);
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('providers.openai.apiKey');
      if (!apiKey) {
        throw new ProviderNotConfiguredException('openai');
      }
      this.client = new OpenAI({ apiKey });
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
