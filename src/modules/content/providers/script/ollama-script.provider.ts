import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  IScriptGenerator,
  IVideoScript,
} from '../../../../domain/interfaces/script-generator.interface';
import { GenerateScriptRequestDto } from '../../../../domain/dto/generate-script.dto';
import { SceneTransition, VideoStyle } from '../../../../domain/enums/video.enums';
import { ScriptGenerationException } from '../../../../common/exceptions/content-generation.exception';

interface IRawScene {
  sequenceNumber: number;
  narration: string;
  imageDescription: string;
  duration: number;
  transition: string;
}

interface IRawScript {
  title: string;
  description: string;
  scenes: IRawScene[];
}

/**
 * Ollama provider uses the OpenAI-compatible API exposed by Ollama locally.
 * Set OLLAMA_BASE_URL (default: http://localhost:11434/v1) and SCRIPT_MODEL (e.g. llama3.2).
 */
@Injectable()
export class OllamaScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(OllamaScriptProvider.name);
  private client?: OpenAI;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'ollama';
  }

  async generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript> {
    this.logger.log(`Generating script for topic: "${request.topic}" on ${request.platform}`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.script.model', 'llama3.2');

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: this.buildUserPrompt(request) },
        ],
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new ScriptGenerationException('ollama', new Error('Empty response from Ollama'));
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ScriptGenerationException(
          'ollama',
          new Error('No JSON found in Ollama response'),
        );
      }

      return this.parseScriptResponse(jsonMatch[0], request);
    } catch (error) {
      if (error instanceof ScriptGenerationException) throw error;
      this.logger.error('Ollama script generation failed', error);
      throw new ScriptGenerationException('ollama', error as Error);
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const baseURL = this.configService.get<string>(
        'OLLAMA_BASE_URL',
        'http://localhost:11434/v1',
      );
      this.client = new OpenAI({
        apiKey: 'ollama', // Ollama does not require a real API key
        baseURL,
      });
    }
    return this.client;
  }

  private getSystemPrompt(): string {
    return `You are an expert video script writer. Generate structured video scripts for social media.

Respond ONLY with valid JSON:
{
  "title": "string",
  "description": "string",
  "scenes": [
    {
      "sequenceNumber": 1,
      "narration": "string",
      "imageDescription": "string (detailed for AI image generation)",
      "duration": 5,
      "transition": "fade"
    }
  ]
}

Rules: Each scene 3-15 seconds. Narration ~2.5 words/sec. Transitions: fade, cut, dissolve, wipe.`;
  }

  private buildUserPrompt(request: GenerateScriptRequestDto): string {
    const parts = [
      `Create a video script:`,
      `Topic: ${request.topic}`,
      `Platform: ${request.platform}`,
      `Duration: ${request.targetDuration} seconds`,
      `Style: ${request.style ?? VideoStyle.CARTOON}`,
    ];

    if (request.targetAudience) parts.push(`Audience: ${request.targetAudience}`);
    if (request.additionalContext) parts.push(`Context: ${request.additionalContext}`);

    return parts.join('\n');
  }

  private parseScriptResponse(content: string, request: GenerateScriptRequestDto): IVideoScript {
    const parsed = JSON.parse(content) as IRawScript;

    const scenes = parsed.scenes.map((scene) => ({
      id: uuidv4(),
      sequenceNumber: scene.sequenceNumber,
      narration: scene.narration,
      imageDescription: scene.imageDescription,
      duration: scene.duration,
      transition: (Object.values(SceneTransition).includes(scene.transition as SceneTransition)
        ? scene.transition
        : SceneTransition.FADE) as SceneTransition,
    }));

    return {
      title: parsed.title,
      description: parsed.description,
      platform: request.platform,
      style: request.style ?? VideoStyle.CARTOON,
      scenes,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      generatedAt: new Date(),
    };
  }
}
