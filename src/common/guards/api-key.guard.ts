import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const apiKey = this.configService.get<string>('API_KEY');

    // If no API_KEY is configured, guard is disabled (dev/test convenience)
    if (!apiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = (request.headers['x-api-key'] as string) ?? request.query['api_key'];

    if (!providedKey || providedKey !== apiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
