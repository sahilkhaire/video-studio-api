import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VideoService } from './video.service';
import { QueueService } from '../queue/queue.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import {
  IEnqueueJobResponse,
  IVideoJobStatusResponse,
} from '../../domain/interfaces/video-job.interface';
import { ITTSVoice } from '../../domain/interfaces/tts-provider.interface';

interface IProvidersResponse {
  script: string;
  image: string;
  tts: string;
}

@ApiTags('videos')
@Controller('videos')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly queueService: QueueService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: 'Enqueue a video generation job',
    description:
      'Adds a video generation job to the background queue. Returns a jobId immediately. Poll GET /videos/jobs/:jobId for status.',
  })
  @ApiBody({ type: GenerateVideoRequestDto })
  @ApiResponse({ status: 202, description: 'Job enqueued — returns jobId' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async enqueueVideo(@Body() dto: GenerateVideoRequestDto): Promise<IEnqueueJobResponse> {
    return this.queueService.enqueueVideoGeneration({
      topic: dto.topic,
      platform: dto.platform,
      style: dto.style,
      targetDuration: dto.targetDuration,
      targetAudience: dto.targetAudience,
      additionalContext: dto.additionalContext,
      resolution: dto.resolution,
      fps: dto.fps,
    });
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get video generation job status' })
  @ApiParam({ name: 'jobId', description: 'UUID returned by POST /videos/generate' })
  @ApiResponse({ status: 200, description: 'Job status returned' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string): Promise<IVideoJobStatusResponse> {
    const status = await this.queueService.getJobStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return status;
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get active AI provider names' })
  @ApiResponse({ status: 200, description: 'Active providers returned' })
  getProviders(): IProvidersResponse {
    return this.videoService.getActiveProviders();
  }

  @Get('tts-voices')
  @ApiOperation({
    summary: 'List available TTS voices for the active provider',
    description:
      'Returns all voices supported by the currently configured TTS provider. Indian voices are flagged with indian: true.',
  })
  @ApiResponse({ status: 200, description: 'Voice list returned' })
  async getTtsVoices(): Promise<ITTSVoice[]> {
    return this.videoService.getTtsVoices();
  }
}
