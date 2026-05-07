import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  IScriptGenerator,
  IVideoScript,
} from '../../../../domain/interfaces/script-generator.interface';
import { GenerateScriptRequestDto } from '../../../../domain/dto/generate-script.dto';
import { SceneTransition, VideoStyle } from '../../../../domain/enums/video.enums';
import {
  ProviderNotConfiguredException,
  ScriptGenerationException,
} from '../../../../common/exceptions/content-generation.exception';

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

@Injectable()
export class ClaudeScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(ClaudeScriptProvider.name);
  private client?: Anthropic;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'claude';
  }

  async generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript> {
    this.logger.log(`Generating script for topic: "${request.topic}" on ${request.platform}`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.script.model', 'claude-opus-4-5');

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `${this.getSystemPrompt()}\n\n${this.buildUserPrompt(request)}`,
          },
        ],
      });

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new ScriptGenerationException(
          'claude',
          new Error('Unexpected response format from Claude'),
        );
      }

      const jsonMatch = block.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ScriptGenerationException(
          'claude',
          new Error('No JSON found in Claude response'),
        );
      }

      return this.parseScriptResponse(jsonMatch[0], request);
    } catch (error) {
      if (error instanceof ScriptGenerationException) throw error;
      this.logger.error('Claude script generation failed', error);
      throw new ScriptGenerationException('claude', error as Error);
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.configService.get<string>('providers.claude.apiKey');
      if (!apiKey) {
        throw new ProviderNotConfiguredException('claude');
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  private getSystemPrompt(): string {
    return `You are an expert video script writer specializing in short-form and long-form social media content.
Generate structured video scripts that will be used to programmatically create videos with AI-generated images and narration.

Respond ONLY with valid JSON matching this exact structure:
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

Rules:
- Each scene should be 3-8 seconds for short-form (< 60s), 5-15 seconds for long-form
- Image descriptions must be rich and specific for AI image generation
- Narration should match scene duration (approx 2.5 words per second)
- Total scene durations must sum to the target duration
- Use transitions: fade, cut, dissolve, or wipe`;
  }

  private buildUserPrompt(request: GenerateScriptRequestDto): string {
    const parts = [
      `Create a video script with the following requirements:`,
      `Topic: ${request.topic}`,
      `Platform: ${request.platform}`,
      `Target Duration: ${request.targetDuration} seconds`,
      `Visual Style: ${request.style ?? VideoStyle.CARTOON}`,
    ];

    if (request.targetAudience) parts.push(`Target Audience: ${request.targetAudience}`);
    if (request.additionalContext) parts.push(`Additional Context: ${request.additionalContext}`);

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
