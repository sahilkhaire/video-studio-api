import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoPlatform, VideoStyle } from '../enums/video.enums';

export class GenerateScriptRequestDto {
  @ApiProperty({ description: 'The topic for the video script', minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  topic!: string;

  @ApiProperty({ enum: VideoPlatform, description: 'Target platform for the video' })
  @IsEnum(VideoPlatform)
  platform!: VideoPlatform;

  @ApiPropertyOptional({
    enum: VideoStyle,
    description: 'Visual style of the video',
    default: VideoStyle.CARTOON,
  })
  @IsEnum(VideoStyle)
  @IsOptional()
  style?: VideoStyle;

  @ApiProperty({ description: 'Target duration in seconds', minimum: 15, maximum: 600 })
  @IsNumber()
  @Min(15)
  @Max(600)
  targetDuration!: number;

  @ApiPropertyOptional({ description: 'Target audience description', maxLength: 200 })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  targetAudience?: string;

  @ApiPropertyOptional({ description: 'Additional context or instructions', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  additionalContext?: string;
}
