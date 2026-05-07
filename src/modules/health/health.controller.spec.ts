import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: jest.Mocked<HealthCheckService>;
  let mockRedis: jest.Mocked<RedisHealthIndicator>;

  const healthyResult = {
    status: 'ok' as const,
    info: { redis: { status: 'up' as const }, disk: { status: 'up' as const } },
    error: {},
    details: { redis: { status: 'up' as const }, disk: { status: 'up' as const } },
  };

  beforeEach(async () => {
    mockHealthService = {
      check: jest.fn().mockResolvedValue(healthyResult),
    } as unknown as jest.Mocked<HealthCheckService>;

    mockRedis = {
      isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    } as unknown as jest.Mocked<RedisHealthIndicator>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthService },
        { provide: DiskHealthIndicator, useValue: { checkStorage: jest.fn() } },
        { provide: MemoryHealthIndicator, useValue: { checkHeap: jest.fn(), checkRSS: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: mockRedis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy result when all indicators pass', async () => {
      // Act
      const result = await controller.check();

      // Assert
      expect(mockHealthService.check).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('ok');
    });

    it('should call health.check with an array of indicator functions', async () => {
      // Act
      await controller.check();

      // Assert
      const [indicators] = mockHealthService.check.mock.calls[0];
      expect(Array.isArray(indicators)).toBe(true);
      expect(indicators.length).toBe(4); // redis, disk, heap, rss
    });
  });
});
