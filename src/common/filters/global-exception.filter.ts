import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ContentGenerationException,
  ProviderNotConfiguredException,
} from '../exceptions/content-generation.exception';

interface IErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  provider?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, provider } = this.resolveException(exception);

    const errorBody: IErrorResponse = {
      statusCode,
      error: HttpStatus[statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (provider) {
      errorBody.provider = provider;
    }

    if (statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} → ${statusCode}: ${message}`);
    }

    response.status(statusCode).json(errorBody);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
    provider?: string;
  } {
    // NestJS built-in HTTP exceptions
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message
            ? Array.isArray((res as { message: string[] }).message)
              ? (res as { message: string[] }).message.join('; ')
              : ((res as { message: string }).message as string)
            : exception.message;
      return { statusCode: exception.getStatus(), message };
    }

    // Provider not configured (400 — client should fix their env)
    if (exception instanceof ProviderNotConfiguredException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message,
        provider: exception.provider,
      };
    }

    // Generic content generation failures (502 — upstream provider error)
    if (exception instanceof ContentGenerationException) {
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: exception.message,
        provider: exception.provider,
      };
    }

    // Unknown errors
    const message = exception instanceof Error ? exception.message : 'An unexpected error occurred';

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message };
  }
}
