import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

interface IReplicatePrediction {
  id: string;
  status: string;
  output?: string[];
  error?: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;
const STABLE_DIFFUSION_MODEL = 'stability-ai/sdxl:39ed52f2319f9b';

@Injectable()
export class StableDiffusionImageProvider implements IImageGenerator {
  private readonly logger = new Logger(StableDiffusionImageProvider.name);

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'stable-diffusion';
  }

  async generateImage(request: GenerateImageRequestDto): Promise<IGeneratedImage> {
    this.logger.log(`Generating image with Stable Diffusion: "${request.prompt.slice(0, 60)}..."`);

    const apiKey = this.getApiKey();
    const size = request.size ?? ImageSize.SQUARE;
    const [width, height] = this.parseDimensions(size);
    const prompt = this.buildPrompt(request);

    try {
      const prediction = await this.createPrediction(apiKey, prompt, width, height);
      const output = await this.pollForCompletion(apiKey, prediction.id);

      return {
        url: output,
        width,
        height,
        format: ImageFormat.PNG,
        prompt: request.prompt,
      };
    } catch (error) {
      if (error instanceof ImageGenerationException) throw error;
      this.logger.error('Stable Diffusion image generation failed', error);
      throw new ImageGenerationException('stable-diffusion', error as Error);
    }
  }

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('providers.replicate.apiKey');
    if (!apiKey) {
      throw new ProviderNotConfiguredException('stable-diffusion');
    }
    return apiKey;
  }

  private async createPrediction(
    apiKey: string,
    prompt: string,
    width: number,
    height: number,
  ): Promise<IReplicatePrediction> {
    const response = await axios.post<IReplicatePrediction>(
      `https://api.replicate.com/v1/models/${STABLE_DIFFUSION_MODEL}/predictions`,
      {
        input: {
          prompt,
          width,
          height,
          num_outputs: 1,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
      },
      {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return response.data;
  }

  private async pollForCompletion(apiKey: string, predictionId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await this.sleep(POLL_INTERVAL_MS);

      const response = await axios.get<IReplicatePrediction>(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: { Authorization: `Token ${apiKey}` },
        },
      );

      const { status, output, error } = response.data;

      if (status === 'succeeded' && output?.[0]) {
        return output[0];
      }
      if (status === 'failed') {
        throw new ImageGenerationException(
          'stable-diffusion',
          new Error(error ?? 'Prediction failed'),
        );
      }
    }

    throw new ImageGenerationException(
      'stable-diffusion',
      new Error('Prediction timed out after polling'),
    );
  }

  private buildPrompt(request: GenerateImageRequestDto): string {
    const parts = [request.prompt];
    if (request.styleModifier) {
      parts.push(request.styleModifier);
    }
    return parts.join(', ');
  }

  private parseDimensions(size: ImageSize): [number, number] {
    const [w, h] = size.split('x').map(Number);
    return [w, h];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
