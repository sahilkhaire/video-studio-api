import { IsEnum, IsOptional, IsNumber, IsString, Min, Max, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntersectionType } from '@nestjs/swagger';
import { GenerateScriptRequestDto } from './generate-script.dto';
import { VideoResolution } from '../interfaces/rendering.interface';

export class GenerateVideoRequestDto extends IntersectionType(GenerateScriptRequestDto) {
  @ApiPropertyOptional({
    enum: VideoResolution,
    description: 'Output video resolution',
    default: VideoResolution.HD_720P,
  })
  @IsEnum(VideoResolution)
  @IsOptional()
  resolution?: VideoResolution;

  @ApiPropertyOptional({ description: 'Frames per second', minimum: 24, maximum: 60, default: 30 })
  @IsNumber()
  @IsOptional()
  @Min(24)
  @Max(60)
  fps?: number;

  @ApiPropertyOptional({
    description:
      'Voice ID for TTS. Use GET /videos/tts-voices to list voices for the active provider.',
    example: 'en-IN-NeerjaNeural',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  voice?: string;
}
