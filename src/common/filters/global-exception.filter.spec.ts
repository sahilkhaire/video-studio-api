import { Test, TestingModule } from '@nestjs/testing';
import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ProviderNotConfiguredException,
  ScriptGenerationException,
} from '../exceptions/content-generation.exception';

const buildHost = (url = '/api/videos/generate', method = 'POST') => {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockRequest = { url, method };
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as never,
    response: mockResponse,
  };
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();
    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('HttpException', () => {
    it('should map BadRequestException to 400', () => {
      // Arrange
      const { host, response } = buildHost();

      // Act
      filter.catch(new BadRequestException('Invalid input'), host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'Invalid input' }),
      );
    });

    it('should map NotFoundException to 404', () => {
      // Arrange
      const { host, response } = buildHost();

      // Act
      filter.catch(new NotFoundException('Job not found'), host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(404);
    });

    it('should join array validation messages', () => {
      // Arrange
      const { host, response } = buildHost();
      const exception = new BadRequestException({
        message: ['field1 required', 'field2 too long'],
      });

      // Act
      filter.catch(exception, host);

      // Assert
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'field1 required; field2 too long' }),
      );
    });
  });

  describe('ProviderNotConfiguredException', () => {
    it('should map to 400 and include provider name', () => {
      // Arrange
      const { host, response } = buildHost();

      // Act
      filter.catch(new ProviderNotConfiguredException('openai'), host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, provider: 'openai' }),
      );
    });
  });

  describe('ContentGenerationException', () => {
    it('should map to 502 and include provider', () => {
      // Arrange
      const { host, response } = buildHost();

      // Act
      filter.catch(new ScriptGenerationException('claude', new Error('timeout')), host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 502, provider: 'claude' }),
      );
    });
  });

  describe('unknown errors', () => {
    it('should map generic Error to 500', () => {
      // Arrange
      const { host, response } = buildHost();

      // Act
      filter.catch(new Error('Something went wrong'), host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500, message: 'Something went wrong' }),
      );
    });

    it('should handle non-Error throws gracefully', () => {
      // Arrange
      const { host, response } = buildHost();

      // Act
      filter.catch('string error', host);

      // Assert
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
    });

    it('should include path and timestamp in response', () => {
      // Arrange
      const { host, response } = buildHost('/api/test', 'GET');

      // Act
      filter.catch(new Error('test'), host);

      // Assert
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/test',
          timestamp: expect.any(String),
        }),
      );
    });
  });
});
