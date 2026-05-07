import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockConnect: jest.Mock;
  let mockPing: jest.Mock;
  let mockDisconnect: jest.Mock;

  const setupMockClient = (pingRejects = false) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('redis');
    mockConnect = jest.fn().mockResolvedValue(undefined);
    mockPing = pingRejects
      ? jest.fn().mockRejectedValue(new Error('Connection refused'))
      : jest.fn().mockResolvedValue('PONG');
    mockDisconnect = jest.fn().mockResolvedValue(undefined);

    createClient.mockReturnValue({
      connect: mockConnect,
      ping: mockPing,
      disconnect: mockDisconnect,
      isOpen: false,
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: unknown) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              return def;
            }),
          },
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  it('should return healthy status when Redis responds to PING', async () => {
    // Arrange
    setupMockClient(false);

    // Act
    const result = await indicator.isHealthy('redis');

    // Assert
    expect(result.redis.status).toBe('up');
    expect(mockPing).toHaveBeenCalledTimes(1);
  });

  it('should throw HealthCheckError when Redis is unreachable', async () => {
    // Arrange
    setupMockClient(true);

    // Act & Assert
    await expect(indicator.isHealthy('redis')).rejects.toThrow(HealthCheckError);
  });
});
