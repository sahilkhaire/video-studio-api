import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  ITTSProvider,
  ITTSVoice,
  IGeneratedAudio,
} from '../../../../domain/interfaces/tts-provider.interface';
import { GenerateAudioRequestDto } from '../../../../domain/dto/generate-audio.dto';
import { AudioFormat } from '../../../../domain/enums/video.enums';
import {
  ProviderNotConfiguredException,
  AudioGenerationException,
} from '../../../../common/exceptions/content-generation.exception';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs default voice (Rachel)
const AVERAGE_WORDS_PER_SECOND = 2.5;

@Injectable()
export class ElevenLabsTTSProvider implements ITTSProvider {
  private readonly logger = new Logger(ElevenLabsTTSProvider.name);

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'elevenlabs';
  }

  getVoices(): Promise<ITTSVoice[]> {
    return Promise.resolve([
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Female',
      },
      {
        id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Female',
      },
      {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Female',
      },
      {
        id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
      {
        id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Elli',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Female',
      },
      {
        id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Josh',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
      {
        id: 'VR6AewLTigWG4xSOukaG',
        name: 'Arnold',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
      {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
      {
        id: 'yoZ06aMxZJJ28mfd3POQ',
        name: 'Sam',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
    ]);
  }

  async generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio> {
    this.logger.log(`Generating TTS audio with ElevenLabs: "${request.text.slice(0, 50)}..."`);

    const apiKey = this.getApiKey();
    const voiceId = request.voice ?? DEFAULT_VOICE_ID;
    const outputPath = await this.resolveOutputPath(request.outputPath);

    try {
      const response = await axios.post<ArrayBuffer>(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
        {
          text: request.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            Accept: 'audio/mpeg',
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        },
      );

      const buffer = Buffer.from(response.data);
      await this.ensureDirectoryExists(outputPath);
      await fs.writeFile(outputPath, buffer);

      this.logger.log(`Audio saved to: ${outputPath}`);

      return {
        filePath: outputPath,
        duration: this.estimateDuration(request.text, request.speed ?? 1.0),
        format: AudioFormat.MP3,
        sampleRate: 44100,
        text: request.text,
      };
    } catch (error) {
      if (error instanceof AudioGenerationException) throw error;
      this.logger.error('ElevenLabs TTS generation failed', error);
      throw new AudioGenerationException('elevenlabs', error as Error);
    }
  }

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('providers.elevenlabs.apiKey');
    if (!apiKey) {
      throw new ProviderNotConfiguredException('elevenlabs');
    }
    return apiKey;
  }

  private async resolveOutputPath(requestedPath?: string): Promise<string> {
    if (requestedPath) return requestedPath;
    const tempDir = this.configService.get<string>('video.storage.tempPath', './temp');
    return join(tempDir, 'audio', `${uuidv4()}.mp3`);
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (dir) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private estimateDuration(text: string, speed: number): number {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return wordCount / (AVERAGE_WORDS_PER_SECOND * speed);
  }
}
