import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { RenderingModule } from '../rendering/rendering.module';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';

@Module({
  imports: [ContentModule, RenderingModule],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
