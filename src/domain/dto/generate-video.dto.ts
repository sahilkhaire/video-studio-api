import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';
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
}
