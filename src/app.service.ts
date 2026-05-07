import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startTime: number;

  constructor(private readonly configService: ConfigService) {
    this.startTime = Date.now();
    this.logger.log('Application service initialized');
  }

  getInfo(): { message: string; version: string } {
    return {
      message: 'Video Generation API',
      version: '0.1.0',
    };
  }

  getHealth(): {
    status: string;
    timestamp: string;
    uptime: number;
    environment: string;
  } {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const environment = this.configService.get<string>('NODE_ENV', 'development');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      environment,
    };
  }
}
