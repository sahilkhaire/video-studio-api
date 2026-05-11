import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg = require('fluent-ffmpeg');
import * as ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic = require('ffprobe-static');
import { promises as fs } from 'fs';
import { isAbsolute, join, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IComposedFrame, IRenderedVideo } from '../../domain/interfaces/rendering.interface';
import { IGeneratedAudio } from '../../domain/interfaces/tts-provider.interface';
import { SceneTransition } from '../../domain/enums/video.enums';

type FFmpegStaticExport = string | { default?: string };

export interface IAssembleVideoOptions {
  frames: IComposedFrame[];
  audioTracks: Array<{
    sceneId: string;
    sequenceNumber: number;
    transition: SceneTransition;
    audio?: IGeneratedAudio;
  }>;
  fps: number;
  outputPath?: string;
  backgroundAudioPath?: string;
  transitionsEnabled?: boolean;
}

interface ISceneClip {
  sceneId: string;
  sequenceNumber: number;
  clipPath: string;
  duration: number;
  width: number;
  height: number;
}

interface IMotionConfig {
  enabled: boolean;
  transitionsEnabled: boolean;
  zoomMin: number;
  zoomMax: number;
  panIntensity: number;
  transitionDurationSec: number;
  preset: string;
  crf: number;
}

@Injectable()
export class VideoAssemblerService {
  private readonly logger = new Logger(VideoAssemblerService.name);

  constructor(private readonly configService: ConfigService) {
    // ffmpeg-static export shape can be string (CJS) or { default: string } (ESM interop).
    const ffmpegPath = this.resolveFfmpegPath(ffmpegStatic as unknown as FFmpegStaticExport);
    ffmpeg.setFfmpegPath(ffmpegPath);
    const ffprobePath: string =
      typeof ffprobeStatic === 'string' ? ffprobeStatic : (ffprobeStatic as { path: string }).path;
    ffmpeg.setFfprobePath(ffprobePath);
    this.logger.log(`FFmpeg binary: ${ffmpegPath}`);
    this.logger.log(`FFprobe binary: ${ffprobePath}`);
  }

  async assembleVideo(options: IAssembleVideoOptions): Promise<IRenderedVideo> {
    const { frames, audioTracks, fps } = options;
    const sortedFrames = [...frames].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const totalDuration = sortedFrames.reduce((sum, f) => sum + f.duration, 0);

    if (sortedFrames.length === 0) {
      throw new Error('Cannot assemble video: no frames provided');
    }

    this.logger.log(`Assembling video: ${sortedFrames.length} frames at ${fps} fps`);

    const tempDir = this.toAbsolutePath(
      this.configService.get<string>('video.storage.tempPath', './temp'),
    );
    const outputDir = this.toAbsolutePath(
      this.configService.get<string>('video.storage.localPath', './storage'),
    );
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = this.toAbsolutePath(
      options.outputPath ?? join(outputDir, `video-${uuidv4()}.mp4`),
    );

    const motionConfig = this.getMotionConfig(options.transitionsEnabled);

    // Step 1: Build scene clips with subtle motion from static frames
    const sceneClips = await this.createSceneClips(sortedFrames, fps, tempDir, motionConfig);

    // Step 2: Merge all audio tracks into one, or skip if none
    const mergedAudioPath = await this.mergeAudioTracks(
      audioTracks,
      tempDir,
      options.backgroundAudioPath,
    );

    // Step 3: Assemble scene clips + audio into final video
    const renderedDuration = await this.runFFmpegWithSceneClips(
      sceneClips,
      audioTracks,
      mergedAudioPath,
      outputPath,
      fps,
      totalDuration,
      motionConfig,
    );

    // Step 4: Cleanup temp files
    await this.cleanupTemp([
      ...sceneClips.map((clip) => clip.clipPath),
      ...(mergedAudioPath ? [mergedAudioPath] : []),
    ]);

    const stats = await fs.stat(outputPath);
    this.logger.log(`Video assembled: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return {
      videoPath: outputPath,
      width: sortedFrames[0].width,
      height: sortedFrames[0].height,
      duration: renderedDuration,
      fps,
      fileSize: stats.size,
      format: 'mp4',
    };
  }

  private async createSceneClips(
    frames: IComposedFrame[],
    fps: number,
    tempDir: string,
    motionConfig: IMotionConfig,
  ): Promise<ISceneClip[]> {
    const sceneClips: ISceneClip[] = [];

    for (const frame of frames) {
      const clipPath = this.toAbsolutePath(join(tempDir, `scene-clip-${uuidv4()}.mp4`));
      await this.renderSceneClip(frame, clipPath, fps, motionConfig);
      sceneClips.push({
        sceneId: frame.sceneId,
        sequenceNumber: frame.sequenceNumber,
        clipPath,
        duration: frame.duration,
        width: frame.width,
        height: frame.height,
      });
    }

    return sceneClips;
  }

  private async renderSceneClip(
    frame: IComposedFrame,
    clipPath: string,
    fps: number,
    motionConfig: IMotionConfig,
  ): Promise<void> {
    const frameCount = Math.max(1, Math.round(frame.duration * fps));
    const motionFilter = motionConfig.enabled
      ? this.buildMotionFilter(frame, frameCount, fps, motionConfig)
      : `scale=${frame.width}:${frame.height}:force_original_aspect_ratio=decrease,pad=${frame.width}:${frame.height}:(ow-iw)/2:(oh-ih)/2`;

    const hasCaption = Boolean(frame.captionPath);

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg().input(this.toAbsolutePath(frame.framePath)).inputOptions(['-loop 1']);

      if (hasCaption) {
        // Input the transparent caption PNG and keep it looped for the clip duration.
        cmd
          .input(this.toAbsolutePath(frame.captionPath!))
          .inputOptions(['-loop 1'])
          // Step 1: animate the background image (zoompan)
          // Step 2: overlay the static caption on top — caption does NOT move
          .complexFilter([`[0:v]${motionFilter}[bg]`, `[bg][1:v]overlay=0:0[out]`])
          .outputOptions([
            `-map [out]`,
            `-r ${fps}`,
            '-pix_fmt yuv420p',
            `-preset ${motionConfig.preset}`,
            `-crf ${motionConfig.crf}`,
            `-t ${frame.duration}`,
          ]);
      } else {
        cmd
          .videoFilters(motionFilter)
          .outputOptions([
            `-r ${fps}`,
            '-pix_fmt yuv420p',
            `-preset ${motionConfig.preset}`,
            `-crf ${motionConfig.crf}`,
            `-t ${frame.duration}`,
          ]);
      }

      cmd
        .videoCodec('libx264')
        .output(this.toAbsolutePath(clipPath))
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  private buildMotionFilter(
    frame: IComposedFrame,
    frameCount: number,
    fps: number,
    motionConfig: IMotionConfig,
  ): string {
    const directionMode = frame.sequenceNumber % 4;
    const panX = directionMode < 2 ? motionConfig.panIntensity : -motionConfig.panIntensity;
    const panY = directionMode % 2 === 0 ? motionConfig.panIntensity : -motionConfig.panIntensity;
    const maxZoom = Math.max(motionConfig.zoomMin, motionConfig.zoomMax);
    const minZoom = Math.min(motionConfig.zoomMin, motionConfig.zoomMax);
    const zoomStep = (maxZoom - minZoom) / Math.max(1, frameCount);

    return [
      `scale=${Math.round(frame.width * 1.2)}:${Math.round(frame.height * 1.2)}:force_original_aspect_ratio=increase`,
      `zoompan=z='min(zoom+${zoomStep.toFixed(6)},${maxZoom.toFixed(4)})':x='(iw-iw/zoom)/2+(${panX.toFixed(4)}*iw)*sin(on/${Math.max(1, Math.round(fps * 0.9))})':y='(ih-ih/zoom)/2+(${panY.toFixed(4)}*ih)*cos(on/${Math.max(1, Math.round(fps * 1.2))})':d=${frameCount}:s=${frame.width}x${frame.height}:fps=${fps}`,
    ].join(',');
  }

  private async mergeAudioTracks(
    audioTracks: Array<{
      sceneId: string;
      sequenceNumber: number;
      transition: SceneTransition;
      audio?: IGeneratedAudio;
    }>,
    tempDir: string,
    backgroundAudioPath?: string,
  ): Promise<string | null> {
    if (backgroundAudioPath) {
      const normalizedBackgroundPath = this.toAbsolutePath(backgroundAudioPath);
      if (await this.fileExists(normalizedBackgroundPath)) {
        return normalizedBackgroundPath;
      }
      this.logger.warn(`Background audio not found: ${normalizedBackgroundPath}`);
    }

    const candidateTracks = [...audioTracks]
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .filter((t) => t.audio?.filePath)
      .map((t) => this.toAbsolutePath(t.audio!.filePath));

    const existingTracks: string[] = [];
    for (const trackPath of candidateTracks) {
      if (await this.fileExists(trackPath)) {
        existingTracks.push(trackPath);
      } else {
        this.logger.warn(`Skipping missing audio track: ${trackPath}`);
      }
    }

    if (existingTracks.length === 0) return null;
    if (existingTracks.length === 1) return existingTracks[0];

    const mergedPath = this.toAbsolutePath(join(tempDir, `audio-merged-${uuidv4()}.mp3`));

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      existingTracks.forEach((track) => cmd.input(track));

      cmd
        .complexFilter([`concat=n=${existingTracks.length}:v=0:a=1[out]`])
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
    totalDuration: number,
    motionConfig: IMotionConfig,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg()
        .input(this.toAbsolutePath(concatFilePath))
        .inputOptions(['-f concat', '-safe 0'])
        .videoCodec('libx264')
        .outputOptions([
          `-r ${fps}`,
          `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
          '-pix_fmt yuv420p',
          `-preset ${motionConfig.preset}`,
          `-crf ${motionConfig.crf}`,
          '-movflags +faststart',
          `-t ${totalDuration}`,
        ]);

      if (audioPath) {
        // Pad audio with silence when it is shorter than the frame timeline.
        cmd.input(this.toAbsolutePath(audioPath)).audioCodec('aac').outputOptions(['-af apad']);
      } else {
        cmd.outputOptions(['-an']); // no audio
      }

      cmd
        .output(this.toAbsolutePath(outputPath))
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

  private async runFFmpegWithSceneClips(
    sceneClips: ISceneClip[],
    audioTracks: Array<{
      sceneId: string;
      sequenceNumber: number;
      transition: SceneTransition;
      audio?: IGeneratedAudio;
    }>,
    audioPath: string | null,
    outputPath: string,
    fps: number,
    totalDuration: number,
    motionConfig: IMotionConfig,
  ): Promise<number> {
    const sortedSceneClips = [...sceneClips].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    if (sortedSceneClips.length === 1 || !motionConfig.transitionsEnabled) {
      const concatFilePath = join(
        this.toAbsolutePath(this.configService.get<string>('video.storage.tempPath', './temp')),
        `concat-${uuidv4()}.txt`,
      );
      await this.writeClipConcatFile(concatFilePath, sortedSceneClips);
      await this.runFFmpeg(
        concatFilePath,
        audioPath,
        outputPath,
        fps,
        sortedSceneClips[0].width,
        sortedSceneClips[0].height,
        totalDuration,
        motionConfig,
      );
      await this.cleanupTemp([concatFilePath]);
      return totalDuration;
    }

    const transitionBySceneId = new Map(
      audioTracks.map((track) => [track.sceneId, track.transition]),
    );
    const transitionDurations: number[] = [];

    for (let i = 1; i < sortedSceneClips.length; i += 1) {
      const prev = sortedSceneClips[i - 1];
      const current = sortedSceneClips[i];
      const maxAllowed = Math.max(0.08, Math.min(prev.duration, current.duration) * 0.45);
      transitionDurations.push(Math.min(motionConfig.transitionDurationSec, maxAllowed));
    }

    const outputDuration =
      totalDuration - transitionDurations.reduce((acc, value) => acc + value, 0);

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      sortedSceneClips.forEach((clip) => cmd.input(this.toAbsolutePath(clip.clipPath)));

      const filters: string[] = [];
      let cumulativeOffset = sortedSceneClips[0].duration;
      let previousLabel = '[0:v]';

      for (let i = 1; i < sortedSceneClips.length; i += 1) {
        const transition =
          transitionBySceneId.get(sortedSceneClips[i - 1].sceneId) ?? SceneTransition.FADE;
        const effect = this.mapSceneTransitionToXFade(transition);
        const transitionDuration = transitionDurations[i - 1];
        const transitionOffset = Math.max(0, cumulativeOffset - transitionDuration);
        const outLabel = `[v${i}]`;

        filters.push(
          `${previousLabel}[${i}:v]xfade=transition=${effect}:duration=${transitionDuration.toFixed(3)}:offset=${transitionOffset.toFixed(3)}${outLabel}`,
        );

        cumulativeOffset += sortedSceneClips[i].duration - transitionDuration;
        previousLabel = outLabel;
      }

      cmd
        .complexFilter(filters)
        .videoCodec('libx264')
        .outputOptions([
          `-map ${previousLabel}`,
          `-r ${fps}`,
          '-pix_fmt yuv420p',
          `-preset ${motionConfig.preset}`,
          `-crf ${motionConfig.crf}`,
          '-movflags +faststart',
          `-t ${outputDuration}`,
        ]);

      if (audioPath) {
        cmd
          .input(this.toAbsolutePath(audioPath))
          .audioCodec('aac')
          // Pad short audio to fill the output duration; -t already caps the output.
          // Do NOT use -shortest: it would truncate the video when TTS audio is
          // shorter than the scene duration, cutting off the last few seconds.
          .outputOptions([`-map ${sortedSceneClips.length}:a`, '-af apad']);
      } else {
        cmd.outputOptions(['-an']);
      }

      cmd
        .output(this.toAbsolutePath(outputPath))
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

    return outputDuration;
  }

  private async writeClipConcatFile(
    concatFilePath: string,
    sceneClips: ISceneClip[],
  ): Promise<void> {
    const lines = sceneClips.map(
      (clip) => `file '${this.escapeForConcat(this.toAbsolutePath(clip.clipPath))}'`,
    );
    await fs.writeFile(concatFilePath, lines.join('\n'));
  }

  private mapSceneTransitionToXFade(transition: SceneTransition): string {
    switch (transition) {
      case SceneTransition.DISSOLVE:
        return 'dissolve';
      case SceneTransition.WIPE:
        return 'wipeleft';
      case SceneTransition.CUT:
        return 'fadeblack';
      case SceneTransition.FADE:
      default:
        return 'fade';
    }
  }

  private getMotionConfig(transitionsEnabledOverride?: boolean): IMotionConfig {
    const defaultTransitionsEnabled = this.configService.get<boolean>(
      'video.motion.transitionsEnabled',
      true,
    );

    return {
      enabled: this.configService.get<boolean>('video.motion.enabled', true),
      transitionsEnabled: transitionsEnabledOverride ?? defaultTransitionsEnabled,
      zoomMin: this.configService.get<number>('video.motion.zoomMin', 1.0),
      zoomMax: this.configService.get<number>('video.motion.zoomMax', 1.12),
      panIntensity: this.configService.get<number>('video.motion.panIntensity', 0.035),
      transitionDurationSec: this.configService.get<number>(
        'video.motion.transitionDurationSec',
        0.45,
      ),
      preset: this.configService.get<string>('video.motion.preset', 'fast'),
      crf: this.configService.get<number>('video.motion.crf', 21),
    };
  }

  private async cleanupTemp(paths: string[]): Promise<void> {
    await Promise.allSettled(paths.map((p) => fs.unlink(p)));
  }

  private resolveFfmpegPath(binaryExport: FFmpegStaticExport): string {
    if (typeof binaryExport === 'string' && binaryExport.length > 0) {
      return binaryExport;
    }

    if (
      binaryExport &&
      typeof binaryExport === 'object' &&
      typeof binaryExport.default === 'string' &&
      binaryExport.default.length > 0
    ) {
      return binaryExport.default;
    }

    this.logger.warn('ffmpeg-static path not found; falling back to system ffmpeg command');
    return 'ffmpeg';
  }

  private toAbsolutePath(filePath: string): string {
    return isAbsolute(filePath) ? filePath : resolve(filePath);
  }

  private escapeForConcat(filePath: string): string {
    // FFmpeg concat uses single-quoted paths; embedded single quotes must be escaped.
    return filePath.replace(/'/g, "'\\''");
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
