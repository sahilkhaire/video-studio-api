import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { VideoStyle } from '../enums/video.enums';
import { VideoAspectRatio, VideoResolution } from '../interfaces/rendering.interface';

export class ContentImageSegmentDto {
  @ApiProperty({
    description: 'Narration/caption content to speak for this segment',
    minLength: 1,
    maxLength: 5000,
    example: 'The first startup rule is to validate demand before you build.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @ApiProperty({
    description:
      'Image URLs for this segment. All images are displayed evenly while segment audio is playing.',
    type: [String],
    example: ['https://images.example.com/scene-1.jpg', 'https://images.example.com/scene-2.jpg'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({ require_protocol: true }, { each: true })
  images!: string[];
}

export class GenerateContentImagesVideoRequestDto {
  @ApiProperty({
    description: 'Ordered list of content+images segments',
    type: [ContentImageSegmentDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContentImageSegmentDto)
  data!: ContentImageSegmentDto[];

  @ApiPropertyOptional({
    description:
      'Show content as captions on top of images while rendering. Defaults to true when omitted.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showCaptions?: boolean;

  @ApiPropertyOptional({
    description:
      'Alias of showCaptions. When provided, controls caption overlay visibility on frames.',
  })
  @IsOptional()
  @IsBoolean()
  showCaption?: boolean;

  @ApiPropertyOptional({
    description: 'Edge TTS voice override. Falls back to EDGE_TTS_VOICE when omitted.',
    example: 'en-US-AriaNeural',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  voice?: string;

  @ApiPropertyOptional({
    enum: VideoStyle,
    description: 'Fallback style for generated background when an image cannot be loaded',
    default: VideoStyle.CINEMATIC,
  })
  @IsOptional()
  @IsEnum(VideoStyle)
  style?: VideoStyle;

  @ApiPropertyOptional({
    enum: VideoResolution,
    description: 'Output video resolution',
    default: VideoResolution.HD_720P,
  })
  @IsOptional()
  @IsEnum(VideoResolution)
  resolution?: VideoResolution;

  @ApiPropertyOptional({
    enum: VideoAspectRatio,
    description: 'Output video aspect ratio',
    default: VideoAspectRatio.LANDSCAPE_16_9,
  })
  @IsOptional()
  @IsEnum(VideoAspectRatio)
  aspectRatio?: VideoAspectRatio;

  @ApiPropertyOptional({
    description: 'Frames per second',
    minimum: 24,
    maximum: 60,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(24)
  @Max(60)
  fps?: number;

  @ApiPropertyOptional({
    description:
      'Optional callback URL. On successful generation, server POSTs completion payload with jobId and videoUrl.',
    example: 'https://client.example.com/webhooks/video-complete',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  callbackUrl?: string;
}
