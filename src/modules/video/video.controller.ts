import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { v4 as uuidv4 } from 'uuid';
import { VideoService } from './video.service';
import { QueueService } from '../queue/queue.service';
import { GenerateVideoRequestDto } from '../../domain/dto/generate-video.dto';
import { GenerateContentImagesVideoRequestDto } from '../../domain/dto/generate-content-images-video.dto';
import { GenerateMusicVideoRequestDto } from '../../domain/dto/generate-music-video.dto';
import {
  IEnqueueJobResponse,
  IVideoJobStatusResponse,
  VideoJobType,
} from '../../domain/interfaces/video-job.interface';
import { ITTSVoice } from '../../domain/interfaces/tts-provider.interface';
import { IMongoDetailsResponse, IVideoGenerationResult } from './video.service';
import { VideoResolution } from '../../domain/interfaces/rendering.interface';
import { TTSProvider } from '../../config/providers.config';

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
      aspectRatio: dto.aspectRatio,
      fps: dto.fps,
      scriptProvider: dto.scriptProvider,
      imageProvider: dto.imageProvider,
      ttsProvider: dto.ttsProvider,
      callbackUrl: dto.callbackUrl,
    });
  }

  @Post('generate-from-content-images')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 4 } })
  @ApiOperation({
    summary: 'Generate final video from provided content segments and image URLs',
    description:
      'Creates narration using free Edge TTS for each segment and displays all provided images evenly during playback. Can optionally overlay captions.',
  })
  @ApiBody({ type: GenerateContentImagesVideoRequestDto })
  @ApiResponse({ status: 200, description: 'Video generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request payload' })
  async generateFromContentImages(
    @Body() dto: GenerateContentImagesVideoRequestDto,
  ): Promise<IVideoGenerationResult> {
    const result = await this.videoService.generateVideoFromContentImages(dto);

    if (dto.callbackUrl) {
      await this.videoService.notifyCallback(dto.callbackUrl, {
        jobId: uuidv4(),
        status: 'completed',
        videoUrl: result.video.videoPath,
      });
    }

    return result;
  }

  @Post('generate-music-story')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60000, limit: 6 } })
  @UseInterceptors(
    FileInterceptor('musicFile', {
      dest: './temp/uploads',
      limits: { fileSize: 80 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Enqueue music-to-visual-story generation job',
    description:
      'Creates visual-only storytelling videos from a song input and guidance. Generates YouTube (16:9) and Reels (9:16) variants in one background job.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: GenerateMusicVideoRequestDto })
  @ApiResponse({ status: 202, description: 'Music visual-story job enqueued — returns jobId' })
  @ApiResponse({ status: 400, description: 'Invalid request or missing music input' })
  async enqueueMusicStoryVideo(
    @Body() dto: GenerateMusicVideoRequestDto,
    @UploadedFile() musicFile?: { path: string; originalname: string },
  ): Promise<IEnqueueJobResponse> {
    if (!musicFile && !dto.musicPath && !dto.musicUrl) {
      throw new BadRequestException(
        'Provide one music input via musicFile, musicPath, or musicUrl',
      );
    }

    if (musicFile) {
      const ext = (musicFile.originalname.split('.').pop() ?? '').toLowerCase();
      if (!['mp3', 'wav'].includes(ext)) {
        throw new BadRequestException('Uploaded music file must be mp3 or wav');
      }
    }

    return this.queueService.enqueueMusicVisualStory({
      jobType: VideoJobType.MUSIC_VISUAL_STORY,
      topic: dto.topic,
      style: dto.style,
      lyrics: dto.lyrics,
      additionalContext: dto.additionalContext,
      musicPath: dto.musicPath,
      musicUrl: dto.musicUrl,
      uploadedMusicPath: musicFile?.path,
      fps: dto.fps,
      youtubeResolution: dto.youtubeResolution ?? VideoResolution.FULL_HD_1080P,
      reelsResolution: dto.reelsResolution ?? VideoResolution.FULL_HD_1080P,
      scriptProvider: dto.scriptProvider,
      imageProvider: dto.imageProvider,
      imageModel: dto.imageModel,
      callbackUrl: dto.callbackUrl,
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

  @Get('providers-models')
  @ApiOperation({
    summary: 'Get all available providers and their models',
    description:
      'Returns a complete list of supported providers and their available models. Useful for dynamic UI selection.',
  })
  @ApiResponse({ status: 200, description: 'Providers and models returned' })
  getProvidersWithModels() {
    return this.videoService.getAvailableProvidersWithModels();
  }

  @Get('tts-voices')
  @ApiOperation({
    summary: 'List available TTS voices for the active provider',
    description:
      'Returns all voices supported by the currently configured TTS provider. Indian voices are flagged with indian: true.',
  })
  @ApiResponse({ status: 200, description: 'Voice list returned' })
  async getTtsVoices(@Query('provider') provider?: TTSProvider): Promise<ITTSVoice[]> {
    return this.videoService.getTtsVoices(provider);
  }

  @Get('mongo-details')
  @ApiOperation({
    summary: 'Get recent MongoDB details',
    description:
      'Returns recent video job documents and cost records from MongoDB for operational visibility.',
  })
  @ApiResponse({ status: 200, description: 'MongoDB details returned' })
  async getMongoDetails(
    @Query('jobLimit') jobLimit?: string,
    @Query('costLimit') costLimit?: string,
  ): Promise<IMongoDetailsResponse> {
    const parsedJobLimit = Number(jobLimit ?? '50');
    const parsedCostLimit = Number(costLimit ?? '100');

    return this.videoService.getMongoDetails(parsedJobLimit, parsedCostLimit);
  }
}
