import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import { promises as fs } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { IComposedFrame, IVideoResolutionSpec } from '../../domain/interfaces/rendering.interface';
import { IGeneratedImage } from '../../domain/interfaces/image-generator.interface';
import { VideoStyle } from '../../domain/enums/video.enums';

export interface IComposeFrameOptions {
  sceneId: string;
  sequenceNumber: number;
  image?: IGeneratedImage;
  narration: string;
  duration: number;
  style: VideoStyle;
  resolution: IVideoResolutionSpec;
}

const SUBTITLE_FONT_SIZE_RATIO = 0.035; // relative to canvas height
const SUBTITLE_FONT_SIZE_RATIO_PORTRAIT = 0.03;
const SUBTITLE_PADDING_RATIO = 0.02;
const SUBTITLE_BOTTOM_SAFE_AREA_RATIO_PORTRAIT = 0.08;

@Injectable()
export class FrameComposerService {
  private readonly logger = new Logger(FrameComposerService.name);

  constructor(private readonly configService: ConfigService) {}

  async composeFrame(options: IComposeFrameOptions): Promise<IComposedFrame> {
    const { sceneId, sequenceNumber, image, narration, duration, style, resolution } = options;
    const { width, height } = resolution;

    this.logger.debug(`Composing frame for scene ${sequenceNumber} (${width}x${height})`);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    await this.drawBackground(ctx, image, width, height, style);
    this.drawSubtitle(ctx, narration, width, height);

    const framePath = await this.saveFrame(canvas, sceneId);

    return { sceneId, sequenceNumber, framePath, width, height, duration };
  }

  private async drawBackground(
    ctx: CanvasRenderingContext2D,
    image: IGeneratedImage | undefined,
    width: number,
    height: number,
    style: VideoStyle,
  ): Promise<void> {
    if (image?.url) {
      try {
        const imgBuffer = await this.fetchImageBuffer(image.url);
        const img = await loadImage(imgBuffer);
        ctx.drawImage(img, 0, 0, width, height);
        return;
      } catch (error) {
        this.logger.warn(`Failed to load image from URL, using fallback background: ${error}`);
      }
    }

    if (image?.base64Data) {
      try {
        const img = await loadImage(Buffer.from(image.base64Data, 'base64'));
        ctx.drawImage(img, 0, 0, width, height);
        return;
      } catch (error) {
        this.logger.warn(`Failed to load base64 image, using fallback background: ${error}`);
      }
    }

    this.drawFallbackBackground(ctx, width, height, style);
  }

  private async fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    return Buffer.from(response.data);
  }

  private drawFallbackBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    style: VideoStyle,
  ): void {
    const colors = this.getStyleColors(style);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  private getStyleColors(style: VideoStyle): { primary: string; secondary: string } {
    const styleColorMap: Record<VideoStyle, { primary: string; secondary: string }> = {
      [VideoStyle.CARTOON]: { primary: '#FF6B6B', secondary: '#4ECDC4' },
      [VideoStyle.REALISTIC]: { primary: '#2C3E50', secondary: '#34495E' },
      [VideoStyle.ANIMATED]: { primary: '#9B59B6', secondary: '#3498DB' },
      [VideoStyle.MINIMAL]: { primary: '#ECF0F1', secondary: '#BDC3C7' },
      [VideoStyle.CINEMATIC]: { primary: '#1A1A2E', secondary: '#16213E' },
    };
    return styleColorMap[style] ?? { primary: '#2C3E50', secondary: '#34495E' };
  }

  private drawSubtitle(
    ctx: CanvasRenderingContext2D,
    narration: string,
    width: number,
    height: number,
  ): void {
    if (!narration.trim()) return;

    const isPortrait = height > width;
    const baseFontRatio = isPortrait ? SUBTITLE_FONT_SIZE_RATIO_PORTRAIT : SUBTITLE_FONT_SIZE_RATIO;
    let fontSize = Math.round(height * baseFontRatio);
    const padding = Math.round(height * SUBTITLE_PADDING_RATIO);
    const blockX = width * 0.05;
    const blockWidth = width * 0.9;
    const maxTextWidth = Math.max(120, blockWidth - padding * 2);

    ctx.textAlign = 'center';
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    let lines = this.wrapText(ctx, narration, maxTextWidth);
    while (lines.length > 3 && fontSize > 18) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      lines = this.wrapText(ctx, narration, maxTextWidth);
    }

    const lineHeight = fontSize * 1.4;
    const blockHeight = lines.length * lineHeight + padding * 2;
    const bottomSafeArea = isPortrait
      ? Math.round(height * SUBTITLE_BOTTOM_SAFE_AREA_RATIO_PORTRAIT)
      : padding;
    const blockY = height - blockHeight - bottomSafeArea;

    // Semi-transparent background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    const radius = padding;
    this.drawRoundedRect(ctx, blockX, blockY, blockWidth, blockHeight, radius);
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;

    lines.forEach((line, idx) => {
      ctx.fillText(line, width / 2, blockY + padding + fontSize + idx * lineHeight);
    });

    ctx.shadowBlur = 0;
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private async saveFrame(
    canvas: ReturnType<typeof createCanvas>,
    sceneId: string,
  ): Promise<string> {
    const tempDir = this.configService.get<string>('video.storage.tempPath', './temp');
    const framesDir = join(tempDir, 'frames');
    await fs.mkdir(framesDir, { recursive: true });

    const framePath = join(framesDir, `frame-${sceneId}-${uuidv4()}.png`);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(framePath, buffer);

    return framePath;
  }
}
