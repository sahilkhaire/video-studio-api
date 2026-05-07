import { GenerateImageRequestDto } from '../dto/generate-image.dto';
import { ImageFormat } from '../enums/video.enums';

export interface IGeneratedImage {
  url?: string;
  base64Data?: string;
  width: number;
  height: number;
  format: ImageFormat;
  prompt: string;
  revisedPrompt?: string;
}

export interface IImageGenerator {
  generateImage(request: GenerateImageRequestDto): Promise<IGeneratedImage>;
  getProviderName(): string;
}
