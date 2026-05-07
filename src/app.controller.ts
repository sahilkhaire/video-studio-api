import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

interface IHealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ status: 200, description: 'API information returned successfully' })
  getInfo(): { message: string; version: string } {
    return this.appService.getInfo();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth(): IHealthResponse {
    return this.appService.getHealth();
  }
}
