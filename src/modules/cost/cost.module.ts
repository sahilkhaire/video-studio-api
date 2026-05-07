import { Module } from '@nestjs/common';
import { CostController } from './cost.controller';
import { CostTrackingService } from './cost-tracking.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CostController],
  providers: [CostTrackingService],
  exports: [CostTrackingService],
})
export class CostModule {}
