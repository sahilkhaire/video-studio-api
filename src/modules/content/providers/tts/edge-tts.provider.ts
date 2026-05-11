import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ITTSProvider,
  ITTSVoice,
  IGeneratedAudio,
} from '../../../../domain/interfaces/tts-provider.interface';
import { GenerateAudioRequestDto } from '../../../../domain/dto/generate-audio.dto';
import { AudioFormat } from '../../../../domain/enums/video.enums';
import { AudioGenerationException } from '../../../../common/exceptions/content-generation.exception';

const AVERAGE_WORDS_PER_SECOND = 2.5;
const DEFAULT_VOICE = 'en-US-AriaNeural';

@Injectable()
export class EdgeTTSProvider implements ITTSProvider {
  private readonly logger = new Logger(EdgeTTSProvider.name);

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'edge-tts';
  }

  getVoices(): Promise<ITTSVoice[]> {
    return Promise.resolve(EDGE_TTS_VOICES);
  }

  async generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio> {
    this.logger.log(`Generating TTS audio via Edge TTS: "${request.text.slice(0, 50)}..."`);

    const voice =
      request.voice ?? this.configService.get<string>('providers.edgeTts.voice', DEFAULT_VOICE);
    const outputPath = this.resolveOutputPath(request.outputPath);
    const workDir = this.resolveWorkingDirectory();
    const tempAudioPath = join(workDir, 'audio.mp3');

    try {
      await this.ensureDirectoryExists(outputPath);
      await fs.mkdir(workDir, { recursive: true });

      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      await tts.toFile(workDir, request.text);

      await fs.rename(tempAudioPath, outputPath);
      await fs.rm(workDir, { recursive: true, force: true });

      this.logger.log(`Edge TTS audio saved to: ${outputPath}`);

      const speed = request.speed ?? 1.0;

      return {
        filePath: outputPath,
        duration: this.estimateDuration(request.text, speed),
        format: AudioFormat.MP3,
        sampleRate: 24000,
        text: request.text,
      };
    } catch (error) {
      if (error instanceof AudioGenerationException) throw error;
      await fs.rm(workDir, { recursive: true, force: true });
      this.logger.error('Edge TTS generation failed', error);
      throw new AudioGenerationException('edge-tts', error as Error);
    }
  }

  private resolveOutputPath(requestedPath?: string): string {
    if (requestedPath) return requestedPath;
    const tempDir = this.configService.get<string>('video.storage.tempPath', './temp');
    return join(tempDir, 'audio', `${uuidv4()}.mp3`);
  }

  private resolveWorkingDirectory(): string {
    const tempDir = this.configService.get<string>('video.storage.tempPath', './temp');
    return join(tempDir, 'audio', `edge-${uuidv4()}`);
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    if (dir) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private estimateDuration(text: string, speed: number): number {
    const wordCount = text.trim().split(/\s+/).length;
    return wordCount / (AVERAGE_WORDS_PER_SECOND * speed);
  }
}

// Curated voice list — Indian voices first, then popular English voices
const EDGE_TTS_VOICES: ITTSVoice[] = [
  // Indian English
  {
    id: 'en-IN-NeerjaNeural',
    name: 'Neerja (Indian English)',
    locale: 'en-IN',
    language: 'English (India)',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'en-IN-PrabhatNeural',
    name: 'Prabhat (Indian English)',
    locale: 'en-IN',
    language: 'English (India)',
    gender: 'Male',
    indian: true,
  },
  // Hindi
  {
    id: 'hi-IN-SwaraNeural',
    name: 'Swara (Hindi)',
    locale: 'hi-IN',
    language: 'Hindi',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'hi-IN-MadhurNeural',
    name: 'Madhur (Hindi)',
    locale: 'hi-IN',
    language: 'Hindi',
    gender: 'Male',
    indian: true,
  },
  // Tamil
  {
    id: 'ta-IN-PallaviNeural',
    name: 'Pallavi (Tamil)',
    locale: 'ta-IN',
    language: 'Tamil',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'ta-IN-ValluvarNeural',
    name: 'Valluvar (Tamil)',
    locale: 'ta-IN',
    language: 'Tamil',
    gender: 'Male',
    indian: true,
  },
  // Telugu
  {
    id: 'te-IN-ShrutiNeural',
    name: 'Shruti (Telugu)',
    locale: 'te-IN',
    language: 'Telugu',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'te-IN-MohanNeural',
    name: 'Mohan (Telugu)',
    locale: 'te-IN',
    language: 'Telugu',
    gender: 'Male',
    indian: true,
  },
  // Marathi
  {
    id: 'mr-IN-AarohiNeural',
    name: 'Aarohi (Marathi)',
    locale: 'mr-IN',
    language: 'Marathi',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'mr-IN-ManoharNeural',
    name: 'Manohar (Marathi)',
    locale: 'mr-IN',
    language: 'Marathi',
    gender: 'Male',
    indian: true,
  },
  // Kannada
  {
    id: 'kn-IN-SapnaNeural',
    name: 'Sapna (Kannada)',
    locale: 'kn-IN',
    language: 'Kannada',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'kn-IN-GaganNeural',
    name: 'Gagan (Kannada)',
    locale: 'kn-IN',
    language: 'Kannada',
    gender: 'Male',
    indian: true,
  },
  // Malayalam
  {
    id: 'ml-IN-SobhanaNeural',
    name: 'Sobhana (Malayalam)',
    locale: 'ml-IN',
    language: 'Malayalam',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'ml-IN-MidhunNeural',
    name: 'Midhun (Malayalam)',
    locale: 'ml-IN',
    language: 'Malayalam',
    gender: 'Male',
    indian: true,
  },
  // Gujarati
  {
    id: 'gu-IN-DhwaniNeural',
    name: 'Dhwani (Gujarati)',
    locale: 'gu-IN',
    language: 'Gujarati',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'gu-IN-NiranjanNeural',
    name: 'Niranjan (Gujarati)',
    locale: 'gu-IN',
    language: 'Gujarati',
    gender: 'Male',
    indian: true,
  },
  // Bengali
  {
    id: 'bn-IN-TanishaaNeural',
    name: 'Tanishaa (Bengali)',
    locale: 'bn-IN',
    language: 'Bengali (India)',
    gender: 'Female',
    indian: true,
  },
  {
    id: 'bn-IN-BashkarNeural',
    name: 'Bashkar (Bengali)',
    locale: 'bn-IN',
    language: 'Bengali (India)',
    gender: 'Male',
    indian: true,
  },
  // Punjabi
  {
    id: 'pa-IN-GurpreetNeural',
    name: 'Gurpreet (Punjabi)',
    locale: 'pa-IN',
    language: 'Punjabi',
    gender: 'Male',
    indian: true,
  },
  // Popular English (non-Indian)
  {
    id: 'en-US-AriaNeural',
    name: 'Aria (US English)',
    locale: 'en-US',
    language: 'English (US)',
    gender: 'Female',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (US English)',
    locale: 'en-US',
    language: 'English (US)',
    gender: 'Male',
  },
  {
    id: 'en-GB-SoniaNeural',
    name: 'Sonia (British)',
    locale: 'en-GB',
    language: 'English (UK)',
    gender: 'Female',
  },
  {
    id: 'en-GB-RyanNeural',
    name: 'Ryan (British)',
    locale: 'en-GB',
    language: 'English (UK)',
    gender: 'Male',
  },
  {
    id: 'en-AU-NatashaNeural',
    name: 'Natasha (Australian)',
    locale: 'en-AU',
    language: 'English (AU)',
    gender: 'Female',
  },
];
