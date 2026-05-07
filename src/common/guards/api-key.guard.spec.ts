import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const buildContext = (
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): ExecutionContext => {
  const mockRequest = { headers, query };
  return {
    switchToHttp: () => ({ getRequest: () => mockRequest }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockReflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    guard = new ApiKeyGuard(mockConfigService, mockReflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('when route is marked @Public()', () => {
    it('should allow access without checking API key', () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(true);
      mockConfigService.get.mockReturnValue('secret-key');

      // Act & Assert — no x-api-key header needed
      expect(guard.canActivate(buildContext())).toBe(true);
    });
  });

  describe('when API_KEY is not configured', () => {
    it('should allow all requests (dev/test mode)', () => {
      // Arrange
      mockConfigService.get.mockReturnValue(undefined);

      // Act & Assert
      expect(guard.canActivate(buildContext())).toBe(true);
    });
  });

  describe('when API_KEY is configured', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue('my-secret-key');
    });

    it('should allow request with correct x-api-key header', () => {
      // Act & Assert
      expect(guard.canActivate(buildContext({ 'x-api-key': 'my-secret-key' }))).toBe(true);
    });

    it('should allow request with correct api_key query param', () => {
      // Act & Assert
      expect(guard.canActivate(buildContext({}, { api_key: 'my-secret-key' }))).toBe(true);
    });

    it('should throw UnauthorizedException for wrong key', () => {
      // Act & Assert
      expect(() => guard.canActivate(buildContext({ 'x-api-key': 'wrong-key' }))).toThrow(
        'Invalid or missing API key',
      );
    });

    it('should throw UnauthorizedException when no key provided', () => {
      // Act & Assert
      expect(() => guard.canActivate(buildContext())).toThrow('Invalid or missing API key');
    });
  });

  describe('reflector metadata key', () => {
    it('should use IS_PUBLIC_KEY when checking handler metadata', () => {
      // Arrange
      const ctx = buildContext();

      // Act
      guard.canActivate(ctx);

      // Assert
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        expect.any(Array),
      );
    });
  });
});
