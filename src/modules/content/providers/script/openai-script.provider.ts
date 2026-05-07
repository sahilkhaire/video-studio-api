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
export class OpenAIScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(OpenAIScriptProvider.name);
  private client?: OpenAI;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'openai';
  }

  async generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript> {
    this.logger.log(`Generating script for topic: "${request.topic}" on ${request.platform}`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.script.model', 'gpt-4o');

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
        throw new ScriptGenerationException('openai', new Error('Empty response from OpenAI'));
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ScriptGenerationException(
          'openai',
          new Error('No JSON found in OpenAI response'),
        );
      }

      return this.parseScriptResponse(jsonMatch[0], request);
    } catch (error) {
      if (error instanceof ScriptGenerationException) throw error;
      this.logger.error('OpenAI script generation failed', error);
      throw new ScriptGenerationException('openai', error as Error);
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('providers.openai.apiKey');
      if (!apiKey) {
        throw new ProviderNotConfiguredException('openai');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  private getSystemPrompt(): string {
    return `You are an expert video script writer specializing in short-form and long-form social media content.
Generate structured video scripts that will be used to programmatically create videos with AI-generated images and narration.

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "string",
  "description": "string (1-2 sentences summarizing the video)",
  "scenes": [
    {
      "sequenceNumber": 1,
      "narration": "string (engaging narration text for this scene)",
      "imageDescription": "string (detailed visual description for AI image generation, include style, colors, composition)",
      "duration": 5,
      "transition": "fade"
    }
  ]
}

Rules:
- Each scene should be 3-8 seconds for short-form (< 60s), 5-15 seconds for long-form
- Image descriptions must be rich and specific for AI image generation
- Narration should match scene duration (approx 2.5 words per second)
- Ensure total scene durations sum to the target duration
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

    if (request.targetAudience) {
      parts.push(`Target Audience: ${request.targetAudience}`);
    }
    if (request.additionalContext) {
      parts.push(`Additional Context: ${request.additionalContext}`);
    }

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
