import { IsString, IsOptional, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateAudioRequestDto {
  @ApiProperty({ description: 'Text to convert to speech', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;

  @ApiPropertyOptional({ description: 'Voice identifier for TTS provider', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  voice?: string;

  @ApiPropertyOptional({
    description: 'Speech speed multiplier',
    minimum: 0.5,
    maximum: 2.0,
    default: 1.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0.5)
  @Max(2.0)
  speed?: number;

  @ApiPropertyOptional({ description: 'Output file path for the generated audio file' })
  @IsString()
  @IsOptional()
  outputPath?: string;
}
