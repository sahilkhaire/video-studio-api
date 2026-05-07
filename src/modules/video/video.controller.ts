import { Controller, Post, Body, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { VideoService, IVideoGenerationResult } from './video.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';

interface IProvidersResponse {
  script: string;
  image: string;
  tts: string;
}

@ApiTags('videos')
@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a complete video',
    description:
      'Orchestrates script generation, AI image generation, TTS audio, and video assembly into a final MP4.',
  })
  @ApiBody({ type: GenerateVideoRequestDto })
  @ApiResponse({ status: 200, description: 'Video generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 500, description: 'Video generation failed' })
  async generateVideo(@Body() dto: GenerateVideoRequestDto): Promise<IVideoGenerationResult> {
    return this.videoService.generateVideo(dto);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get active AI provider names' })
  @ApiResponse({ status: 200, description: 'Active providers returned' })
  getProviders(): IProvidersResponse {
    return this.videoService.getActiveProviders();
  }
}
