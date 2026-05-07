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
const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';
const FALLBACK_MODELS = ['black-forest-labs/FLUX.1-schnell'];

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
    const configuredModel = this.configService.get<string>(
      'providers.together.imageModel',
      this.configService.get<string>('providers.image.model', DEFAULT_MODEL),
    );
    const candidateModels = this.buildCandidateModels(configuredModel);
    const maxAttempts = Math.max(
      1,
      this.configService.get<number>('providers.together.maxAttempts', 3),
    );
    const size = request.size ?? ImageSize.SQUARE;
    const prompt = this.buildPrompt(request);
    const [width, height] = this.parseDimensions(size);

    let lastError: unknown;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await client.images.generate({
            model,
            prompt,
            n: 1,
            response_format: 'b64_json',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ width, height } as any),
          });

          const imageData = response.data ?? [];
          const image = imageData[0];
          if (!image?.b64_json) {
            throw new ImageGenerationException(
              'together-ai',
              new Error('No image data in TogetherAI response'),
            );
          }

          return {
            base64Data: image.b64_json,
            width,
            height,
            format: ImageFormat.PNG,
            prompt: request.prompt,
          };
        } catch (error) {
          if (error instanceof ImageGenerationException) {
            throw error;
          }

          lastError = error;

          if (
            this.isNonServerlessModelError(error) &&
            model !== candidateModels[candidateModels.length - 1]
          ) {
            this.logger.warn(
              `TogetherAI model ${model} requires a dedicated endpoint; trying fallback model.`,
            );
            break;
          }

          if (this.isRateLimitError(error) && attempt < maxAttempts) {
            const delayMs = 500 * attempt;
            this.logger.warn(
              `TogetherAI rate-limited. Retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts}).`,
            );
            await this.sleep(delayMs);
            continue;
          }

          this.logger.error('TogetherAI image generation failed', error as Error);
          throw new ImageGenerationException('together-ai', error as Error);
        }
      }
    }

    this.logger.error('TogetherAI image generation failed', lastError as Error);
    throw new ImageGenerationException('together-ai', lastError as Error);
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

  private buildCandidateModels(configuredModel: string): string[] {
    const models = [configuredModel, ...FALLBACK_MODELS];
    const filtered = models.filter((model) => model && model.trim().length > 0);
    return [...new Set(filtered)];
  }

  private isRateLimitError(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    const message = (error as { message?: string })?.message?.toLowerCase() ?? '';
    return status === 429 || message.includes('rate limit');
  }

  private isNonServerlessModelError(error: unknown): boolean {
    const message = (error as { message?: string })?.message?.toLowerCase() ?? '';
    return message.includes('non-serverless model') || message.includes('dedicated endpoint');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
