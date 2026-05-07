import { Controller, Delete, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ICostSummary } from '../../domain/interfaces/cost-tracking.interface';
import { CostTrackingService } from './cost-tracking.service';

@ApiTags('costs')
@Public()
@Controller('costs')
export class CostController {
  constructor(private readonly costTrackingService: CostTrackingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregated cost summary across all providers' })
  @ApiResponse({ status: 200, description: 'Cost summary returned successfully' })
  getSummary(): ICostSummary {
    return this.costTrackingService.getSummary();
  }

  @Delete('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset all recorded cost data' })
  @ApiResponse({ status: 204, description: 'Cost data cleared successfully' })
  reset(): void {
    this.costTrackingService.reset();
  }
}
