import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage, ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import { AppThrottlerGuard } from './throttler.guard';

const buildContext = (_isPublic = false): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ ip: '127.0.0.1', headers: {}, path: '/api/test' }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;
  let mockReflector: jest.Mocked<Reflector>;

  const mockStorage: jest.Mocked<ThrottlerStorage> = {
    increment: jest.fn().mockResolvedValue({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    }),
  };

  const throttlerOptions: ThrottlerModuleOptions = {
    throttlers: [{ name: 'default', ttl: 60000, limit: 100 } as ThrottlerOptions],
  };

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    guard = new AppThrottlerGuard(throttlerOptions, mockStorage, mockReflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('shouldSkip', () => {
    it('should skip throttling for public routes', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = await guard['shouldSkip'](buildContext(true));

      // Assert
      expect(result).toBe(true);
    });

    it('should not skip throttling for protected routes', async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(false);

      // Act
      const result = await guard['shouldSkip'](buildContext(false));

      // Assert
      expect(result).toBe(false);
    });
  });
});
