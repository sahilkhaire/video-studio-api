import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg = require('fluent-ffmpeg');
import * as ffmpegStatic from 'ffmpeg-static';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IComposedFrame, IRenderedVideo } from '../../domain/interfaces/rendering.interface';
import { IGeneratedAudio } from '../../domain/interfaces/tts-provider.interface';

export interface IAssembleVideoOptions {
  frames: IComposedFrame[];
  audioTracks: Array<{ sceneId: string; audio?: IGeneratedAudio }>;
  fps: number;
  outputPath?: string;
}

@Injectable()
export class VideoAssemblerService {
  private readonly logger = new Logger(VideoAssemblerService.name);

  constructor(private readonly configService: ConfigService) {
    // Use bundled ffmpeg-static binary if no system ffmpeg is available
    const ffmpegPath = (ffmpegStatic as unknown as string) ?? 'ffmpeg';
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  async assembleVideo(options: IAssembleVideoOptions): Promise<IRenderedVideo> {
    const { frames, audioTracks, fps } = options;

    if (frames.length === 0) {
      throw new Error('Cannot assemble video: no frames provided');
    }

    this.logger.log(`Assembling video: ${frames.length} frames at ${fps} fps`);

    const tempDir = this.configService.get<string>('video.storage.tempPath', './temp');
    const outputDir = this.configService.get<string>('video.storage.localPath', './storage');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = options.outputPath ?? join(outputDir, `video-${uuidv4()}.mp4`);

    // Step 1: Build a concat file listing each frame with its duration
    const concatFilePath = join(tempDir, `concat-${uuidv4()}.txt`);
    await this.writeConcatFile(concatFilePath, frames);

    // Step 2: Merge all audio tracks into one, or skip if none
    const mergedAudioPath = await this.mergeAudioTracks(audioTracks, tempDir);

    // Step 3: Assemble frames + audio into final video
    await this.runFFmpeg(
      concatFilePath,
      mergedAudioPath,
      outputPath,
      fps,
      frames[0].width,
      frames[0].height,
    );

    // Step 4: Cleanup temp files
    await this.cleanupTemp([concatFilePath, ...(mergedAudioPath ? [mergedAudioPath] : [])]);

    const stats = await fs.stat(outputPath);
    const totalDuration = frames.reduce((sum, f) => sum + f.duration, 0);

    this.logger.log(`Video assembled: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return {
      videoPath: outputPath,
      width: frames[0].width,
      height: frames[0].height,
      duration: totalDuration,
      fps,
      fileSize: stats.size,
      format: 'mp4',
    };
  }

  private async writeConcatFile(concatFilePath: string, frames: IComposedFrame[]): Promise<void> {
    const lines = frames
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .flatMap((frame) => [`file '${frame.framePath}'`, `duration ${frame.duration}`]);

    // FFmpeg concat demuxer requires duplicating the last frame line
    const lastFrame = frames[frames.length - 1];
    lines.push(`file '${lastFrame.framePath}'`);

    await fs.writeFile(concatFilePath, lines.join('\n'));
  }

  private async mergeAudioTracks(
    audioTracks: Array<{ sceneId: string; audio?: IGeneratedAudio }>,
    tempDir: string,
  ): Promise<string | null> {
    const validTracks = audioTracks.filter((t) => t.audio?.filePath).map((t) => t.audio!.filePath);

    if (validTracks.length === 0) return null;
    if (validTracks.length === 1) return validTracks[0];

    const mergedPath = join(tempDir, `audio-merged-${uuidv4()}.mp3`);

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      validTracks.forEach((track) => cmd.input(track));

      cmd
        .complexFilter([`concat=n=${validTracks.length}:v=0:a=1[out]`])
        .outputOptions(['-map [out]'])
        .output(mergedPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    return mergedPath;
  }

  private async runFFmpeg(
    concatFilePath: string,
    audioPath: string | null,
    outputPath: string,
    fps: number,
    width: number,
    height: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .videoCodec('libx264')
        .outputOptions([
          `-r ${fps}`,
          `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
          '-pix_fmt yuv420p',
          '-preset fast',
          '-crf 23',
          '-movflags +faststart',
        ]);

      if (audioPath) {
        cmd.input(audioPath).audioCodec('aac').outputOptions(['-shortest']);
      } else {
        cmd.outputOptions(['-an']); // no audio
      }

      cmd
        .output(outputPath)
        .on('start', (cmdLine: string) => this.logger.debug(`FFmpeg started: ${cmdLine}`))
        .on('progress', (progress: { percent?: number }) => {
          if (progress.percent) {
            this.logger.debug(`FFmpeg progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          this.logger.debug('FFmpeg finished');
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error(`FFmpeg error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  private async cleanupTemp(paths: string[]): Promise<void> {
    await Promise.allSettled(paths.map((p) => fs.unlink(p)));
  }
}
