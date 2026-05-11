import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoResolution } from '../interfaces/rendering.interface';
import { VideoStyle } from '../enums/video.enums';
import { ImageProvider, ScriptProvider } from '../../config/providers.config';

export class GenerateMusicVideoRequestDto {
  @ApiProperty({
    description: 'Story topic to guide scene generation',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  topic!: string;

  @ApiPropertyOptional({
    description: 'Optional lyrics used as narrative guidance for visual scene planning',
    maxLength: 8000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(8000)
  lyrics?: string;

  @ApiPropertyOptional({
    description: 'Optional local server file path for music input (mp3/wav)',
    example: './media/storage/song.mp3',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  musicPath?: string;

  @ApiPropertyOptional({
    description: 'Optional remote URL for music input (mp3/wav)',
    example: 'https://example.com/song.mp3',
  })
  @IsUrl({ require_tld: false }, { message: 'musicUrl must be a valid URL' })
  @IsOptional()
  musicUrl?: string;

  @ApiPropertyOptional({ description: 'Extra guidance for visual storytelling', maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  additionalContext?: string;

  @ApiPropertyOptional({ enum: VideoStyle, default: VideoStyle.CARTOON })
  @IsEnum(VideoStyle)
  @IsOptional()
  style?: VideoStyle;

  @ApiPropertyOptional({ enum: ScriptProvider, description: 'Override default script provider' })
  @IsEnum(ScriptProvider)
  @IsOptional()
  scriptProvider?: ScriptProvider;

  @ApiPropertyOptional({ enum: ImageProvider, description: 'Override default image provider' })
  @IsEnum(ImageProvider)
  @IsOptional()
  imageProvider?: ImageProvider;

  @ApiPropertyOptional({
    description:
      'Override the model used by the selected image provider (e.g. "dall-e-3", "black-forest-labs/FLUX.1-pro")',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  imageModel?: string;

  @ApiPropertyOptional({
    enum: VideoResolution,
    default: VideoResolution.FULL_HD_1080P,
    description: 'Target quality for YouTube output (16:9)',
  })
  @IsEnum(VideoResolution)
  @IsOptional()
  youtubeResolution?: VideoResolution;

  @ApiPropertyOptional({
    enum: VideoResolution,
    default: VideoResolution.FULL_HD_1080P,
    description: 'Target quality for Instagram Reels output (9:16)',
  })
  @IsEnum(VideoResolution)
  @IsOptional()
  reelsResolution?: VideoResolution;

  @ApiPropertyOptional({ description: 'Frames per second', minimum: 24, maximum: 60, default: 30 })
  @IsNumber()
  @IsOptional()
  @Min(24)
  @Max(60)
  fps?: number;

  @ApiPropertyOptional({
    description:
      'Optional callback URL. On successful generation, server POSTs completion payload with jobId and videoUrl.',
    example: 'https://client.example.com/webhooks/video-complete',
  })
  @IsUrl({ require_protocol: true }, { message: 'callbackUrl must be a valid URL' })
  @IsOptional()
  callbackUrl?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Optional uploaded music file (mp3/wav). If provided, it takes priority over musicPath/musicUrl.',
  })
  @IsOptional()
  musicFile?: unknown;
}
