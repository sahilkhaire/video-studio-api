import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CostModule } from '../cost/cost.module';
import { CacheModule } from '../cache/cache.module';
import { ContentService } from './content.service';
import { OpenAIScriptProvider } from './providers/script/openai-script.provider';
import { ClaudeScriptProvider } from './providers/script/claude-script.provider';
import { OllamaScriptProvider } from './providers/script/ollama-script.provider';
import { DALLEImageProvider } from './providers/image/dalle-image.provider';
import { StableDiffusionImageProvider } from './providers/image/stable-diffusion-image.provider';
import { OpenAITTSProvider } from './providers/tts/openai-tts.provider';
import { ElevenLabsTTSProvider } from './providers/tts/elevenlabs-tts.provider';
import { IScriptGenerator } from '../../domain/interfaces/script-generator.interface';
import { IImageGenerator } from '../../domain/interfaces/image-generator.interface';
import { ITTSProvider } from '../../domain/interfaces/tts-provider.interface';
import { SCRIPT_GENERATOR, IMAGE_GENERATOR, TTS_PROVIDER } from './constants/injection-tokens';
import { ScriptProvider, ImageProvider, TTSProvider } from '../../config/providers.config';

@Module({
  imports: [ConfigModule, CostModule, CacheModule],
  providers: [
    // Concrete provider implementations
    OpenAIScriptProvider,
    ClaudeScriptProvider,
    OllamaScriptProvider,
    DALLEImageProvider,
    StableDiffusionImageProvider,
    OpenAITTSProvider,
    ElevenLabsTTSProvider,

    // Script generator: resolved at startup based on SCRIPT_PROVIDER env var
    {
      provide: SCRIPT_GENERATOR,
      useFactory: (
        configService: ConfigService,
        openai: OpenAIScriptProvider,
        claude: ClaudeScriptProvider,
        ollama: OllamaScriptProvider,
      ): IScriptGenerator => {
        const provider = configService.get<string>(
          'providers.script.provider',
          ScriptProvider.OPENAI,
        );
        switch (provider) {
          case ScriptProvider.CLAUDE:
            return claude;
          case ScriptProvider.OLLAMA:
            return ollama;
          default:
            return openai;
        }
      },
      inject: [ConfigService, OpenAIScriptProvider, ClaudeScriptProvider, OllamaScriptProvider],
    },

    // Image generator: resolved at startup based on IMAGE_PROVIDER env var
    {
      provide: IMAGE_GENERATOR,
      useFactory: (
        configService: ConfigService,
        dalle: DALLEImageProvider,
        sd: StableDiffusionImageProvider,
      ): IImageGenerator => {
        const provider = configService.get<string>('providers.image.provider', ImageProvider.DALLE);
        switch (provider) {
          case ImageProvider.STABLE_DIFFUSION:
            return sd;
          default:
            return dalle;
        }
      },
      inject: [ConfigService, DALLEImageProvider, StableDiffusionImageProvider],
    },

    // TTS provider: resolved at startup based on TTS_PROVIDER env var
    {
      provide: TTS_PROVIDER,
      useFactory: (
        configService: ConfigService,
        openaiTts: OpenAITTSProvider,
        elevenlabs: ElevenLabsTTSProvider,
      ): ITTSProvider => {
        const provider = configService.get<string>('providers.tts.provider', TTSProvider.OPENAI);
        switch (provider) {
          case TTSProvider.ELEVENLABS:
            return elevenlabs;
          default:
            return openaiTts;
        }
      },
      inject: [ConfigService, OpenAITTSProvider, ElevenLabsTTSProvider],
    },

    ContentService,
  ],
  exports: [ContentService],
})
export class ContentModule {}
