import { Injectable } from '@nestjs/common';
import { ImageProvider, ScriptProvider, TTSProvider } from '../../config/providers.config';
import { IImageGenerator } from '../../domain/interfaces/image-generator.interface';
import { IScriptGenerator } from '../../domain/interfaces/script-generator.interface';
import { ITTSProvider } from '../../domain/interfaces/tts-provider.interface';
import { DALLEImageProvider } from './providers/image/dalle-image.provider';
import { StableDiffusionImageProvider } from './providers/image/stable-diffusion-image.provider';
import { TogetherImageProvider } from './providers/image/together-image.provider';
import { ClaudeScriptProvider } from './providers/script/claude-script.provider';
import { GroqScriptProvider } from './providers/script/groq-script.provider';
import { OllamaScriptProvider } from './providers/script/ollama-script.provider';
import { OpenAIScriptProvider } from './providers/script/openai-script.provider';
import { TogetherScriptProvider } from './providers/script/together-script.provider';
import { EdgeTTSProvider } from './providers/tts/edge-tts.provider';
import { ElevenLabsTTSProvider } from './providers/tts/elevenlabs-tts.provider';
import { GroqTTSProvider } from './providers/tts/groq-tts.provider';
import { OpenAITTSProvider } from './providers/tts/openai-tts.provider';

@Injectable()
export class ProviderResolverService {
  constructor(
    private readonly openaiScriptProvider: OpenAIScriptProvider,
    private readonly claudeScriptProvider: ClaudeScriptProvider,
    private readonly ollamaScriptProvider: OllamaScriptProvider,
    private readonly togetherScriptProvider: TogetherScriptProvider,
    private readonly groqScriptProvider: GroqScriptProvider,
    private readonly dalleImageProvider: DALLEImageProvider,
    private readonly stableDiffusionImageProvider: StableDiffusionImageProvider,
    private readonly togetherImageProvider: TogetherImageProvider,
    private readonly openaiTtsProvider: OpenAITTSProvider,
    private readonly elevenLabsTtsProvider: ElevenLabsTTSProvider,
    private readonly edgeTtsProvider: EdgeTTSProvider,
    private readonly groqTtsProvider: GroqTTSProvider,
  ) {}

  resolveScriptProvider(provider?: ScriptProvider, fallback?: IScriptGenerator): IScriptGenerator {
    switch (provider) {
      case ScriptProvider.CLAUDE:
        return this.claudeScriptProvider;
      case ScriptProvider.OLLAMA:
        return this.ollamaScriptProvider;
      case ScriptProvider.TOGETHER_AI:
        return this.togetherScriptProvider;
      case ScriptProvider.GROQ:
        return this.groqScriptProvider;
      case ScriptProvider.OPENAI:
        return this.openaiScriptProvider;
      default:
        return fallback ?? this.openaiScriptProvider;
    }
  }

  resolveImageProvider(provider?: ImageProvider, fallback?: IImageGenerator): IImageGenerator {
    switch (provider) {
      case ImageProvider.STABLE_DIFFUSION:
        return this.stableDiffusionImageProvider;
      case ImageProvider.TOGETHER_AI:
        return this.togetherImageProvider;
      case ImageProvider.DALLE:
      default:
        return fallback ?? this.dalleImageProvider;
    }
  }

  resolveTtsProvider(provider?: TTSProvider, fallback?: ITTSProvider): ITTSProvider {
    switch (provider) {
      case TTSProvider.ELEVENLABS:
        return this.elevenLabsTtsProvider;
      case TTSProvider.EDGE_TTS:
      case TTSProvider.GOOGLE_TTS:
      case TTSProvider.COQUI:
        return this.edgeTtsProvider;
      case TTSProvider.GROQ:
        return this.groqTtsProvider;
      case TTSProvider.OPENAI:
      default:
        return fallback ?? this.openaiTtsProvider;
    }
  }
}
