import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
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

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

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
export class GroqScriptProvider implements IScriptGenerator {
  private readonly logger = new Logger(GroqScriptProvider.name);
  private client?: Groq;

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'groq';
  }

  async generateScript(request: GenerateScriptRequestDto): Promise<IVideoScript> {
    this.logger.log(`Generating script via Groq for topic: "${request.topic}" on ${request.platform}`);

    const client = this.getClient();
    const model = this.configService.get<string>('providers.script.model', DEFAULT_MODEL);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: this.buildUserPrompt(request) },
        ],
        temperature: 0.7,
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === 'string' ? rawContent : '';
      if (!content) {
        throw new ScriptGenerationException('groq', new Error('Empty response from Groq'));
      }

      const normalized = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const jsonMatch = normalized.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ScriptGenerationException('groq', new Error('No JSON found in Groq response'));
      }

      return this.parseScriptResponse(jsonMatch[0], request);
    } catch (error) {
      if (error instanceof ScriptGenerationException) throw error;
      this.logger.error('Groq script generation failed', error);
      throw new ScriptGenerationException('groq', error as Error);
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