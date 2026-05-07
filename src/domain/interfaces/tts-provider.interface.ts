import { GenerateAudioRequestDto } from '../dto/generate-audio.dto';
import { AudioFormat } from '../enums/video.enums';

export interface ITTSVoice {
  id: string;
  name: string;
  locale: string;
  language: string;
  gender: 'Male' | 'Female' | 'Unknown';
  /** True for Indian language voices (hi-IN, ta-IN, etc.) or Indian English */
  indian?: boolean;
}

export interface IGeneratedAudio {
  filePath: string;
  duration: number;
  format: AudioFormat;
  sampleRate: number;
  text: string;
}

export interface ITTSProvider {
  generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio>;
  getVoices(): Promise<ITTSVoice[]>;
  getProviderName(): string;
}
