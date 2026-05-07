import { Module, forwardRef } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { RenderingModule } from '../rendering/rendering.module';
import { QueueModule } from '../queue/queue.module';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';

@Module({
  imports: [ContentModule, RenderingModule, forwardRef(() => QueueModule)],
  controllers: [VideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
