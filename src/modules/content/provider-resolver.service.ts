import { Injectable } from '@nestjs/common';
import { ImageProvider, ScriptProvider } from '../../config/providers.config';
import { IImageGenerator } from '../../domain/interfaces/image-generator.interface';
import { IScriptGenerator } from '../../domain/interfaces/script-generator.interface';
import { DALLEImageProvider } from './providers/image/dalle-image.provider';
import { StableDiffusionImageProvider } from './providers/image/stable-diffusion-image.provider';
import { TogetherImageProvider } from './providers/image/together-image.provider';
import { ClaudeScriptProvider } from './providers/script/claude-script.provider';
import { GroqScriptProvider } from './providers/script/groq-script.provider';
import { OllamaScriptProvider } from './providers/script/ollama-script.provider';
import { OpenAIScriptProvider } from './providers/script/openai-script.provider';
import { TogetherScriptProvider } from './providers/script/together-script.provider';

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
}
