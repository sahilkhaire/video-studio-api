import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  DiskHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Deep health check (Redis, disk, memory)' })
  @ApiResponse({ status: 200, description: 'All systems healthy' })
  @ApiResponse({ status: 503, description: 'One or more systems unhealthy' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      (): Promise<HealthIndicatorResult> => this.redisIndicator.isHealthy('redis'),
      (): Promise<HealthIndicatorResult> =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.9,
          path: process.platform === 'win32' ? 'C:\\' : '/',
        }),
      (): Promise<HealthIndicatorResult> => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB
      (): Promise<HealthIndicatorResult> => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024), // 512 MB
    ]);
  }
}
