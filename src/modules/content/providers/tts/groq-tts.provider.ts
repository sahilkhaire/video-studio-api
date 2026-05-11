import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import Groq from 'groq-sdk';
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

const AVERAGE_WORDS_PER_SECOND = 2.5;
const DEFAULT_MODEL = 'playai-tts';
const DEFAULT_VOICE = 'Fritz-PlayAI';

@Injectable()
export class GroqTTSProvider implements ITTSProvider {
  private readonly logger = new Logger(GroqTTSProvider.name);
  private client?: Groq;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'groq';
  }

  getVoices(): Promise<ITTSVoice[]> {
    return Promise.resolve([
      {
        id: 'Fritz-PlayAI',
        name: 'Fritz',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
      {
        id: 'Celeste-PlayAI',
        name: 'Celeste',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Female',
      },
      {
        id: 'Arista-PlayAI',
        name: 'Arista',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Female',
      },
      {
        id: 'Angelo-PlayAI',
        name: 'Angelo',
        locale: 'en-US',
        language: 'English (US)',
        gender: 'Male',
      },
    ]);
  }

  async generateAudio(request: GenerateAudioRequestDto): Promise<IGeneratedAudio> {
    this.logger.log(`Generating TTS audio with Groq: "${request.text.slice(0, 50)}..."`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.tts.model', DEFAULT_MODEL);
    const voice = request.voice ?? this.configService.get<string>('providers.tts.voice', DEFAULT_VOICE);
    const speed = request.speed ?? 1.0;
    const outputPath = await this.resolveOutputPath(request.outputPath);

    try {
      const response = await client.audio.speech.create({
        model,
        voice,
        input: request.text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      await this.ensureDirectoryExists(outputPath);
      await fs.writeFile(outputPath, buffer);

      this.logger.log(`Groq audio saved to: ${outputPath}`);

      return {
        filePath: outputPath,
        duration: this.estimateDuration(request.text, speed),
        format: AudioFormat.MP3,
        sampleRate: 24000,
        text: request.text,
      };
    } catch (error) {
      if (error instanceof AudioGenerationException) throw error;
      this.logger.error('Groq TTS generation failed', error);
      throw new AudioGenerationException('groq', error as Error);
    }
  }

  private getClient(): Groq {
    if (!this.client) {
      const apiKey = this.configService.get<string>('providers.groq.apiKey');
      if (!apiKey) {
        throw new ProviderNotConfiguredException('groq');
      }
      this.client = new Groq({ apiKey });
    }
    return this.client;
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