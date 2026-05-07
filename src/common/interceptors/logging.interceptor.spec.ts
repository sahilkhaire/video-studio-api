import { Test, TestingModule } from '@nestjs/testing';
import { LoggingInterceptor } from './logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

const buildContext = (method = 'GET', url = '/api/health'): ExecutionContext => {
  const mockResponse = { statusCode: 200 };
  const mockRequest = { method, url };
  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as ExecutionContext;
};

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();
    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass the response through unchanged', (done) => {
    // Arrange
    const ctx = buildContext('GET', '/api/health');
    const payload = { status: 'ok' };
    const handler: CallHandler = { handle: () => of(payload) };

    // Act
    interceptor.intercept(ctx, handler).subscribe({
      next: (value) => {
        // Assert
        expect(value).toEqual(payload);
        done();
      },
    });
  });

  it('should propagate errors without swallowing them', (done) => {
    // Arrange
    const ctx = buildContext('POST', '/api/videos/generate');
    const handler: CallHandler = { handle: () => throwError(() => new Error('Provider failed')) };

    // Act
    interceptor.intercept(ctx, handler).subscribe({
      error: (err: Error) => {
        // Assert
        expect(err.message).toBe('Provider failed');
        done();
      },
    });
  });
});
