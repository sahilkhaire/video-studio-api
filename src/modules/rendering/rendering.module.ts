import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FrameComposerService } from './frame-composer.service';
import { VideoAssemblerService } from './video-assembler.service';
import { RenderingService } from './rendering.service';

@Module({
  imports: [ConfigModule],
  providers: [FrameComposerService, VideoAssemblerService, RenderingService],
  exports: [RenderingService],
})
export class RenderingModule {}
