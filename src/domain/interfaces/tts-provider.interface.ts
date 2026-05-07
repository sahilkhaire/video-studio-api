import { GenerateAudioRequestDto } from '../dto/generate-audio.dto';
import { AudioFormat } from '../enums/video.enums';

export interface IGeneratedAudio {
  filePath: string;
  duration: number;
  format: AudioFormat;
  sampleRate: number;
  text: string;
}

export interface ITTSProvider {
  generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio>;
  getProviderName(): string;
}
