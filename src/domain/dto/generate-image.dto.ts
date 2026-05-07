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
import { ImageSize } from '../enums/video.enums';

export class GenerateImageRequestDto {
  @ApiProperty({ description: 'Detailed image generation prompt', minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  prompt!: string;

  @ApiPropertyOptional({
    enum: ImageSize,
    description: 'Size of the generated image',
    default: ImageSize.SQUARE,
  })
  @IsEnum(ImageSize)
  @IsOptional()
  size?: ImageSize;

  @ApiPropertyOptional({
    description: 'Style modifier (e.g. "cartoon", "photorealistic")',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  styleModifier?: string;

  @ApiPropertyOptional({
    description: 'Number of images to generate',
    minimum: 1,
    maximum: 4,
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(4)
  count?: number;
}
