import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    let client: RedisClientType | null = null;
    try {
      client = createClient({ socket: { host, port, connectTimeout: 3000 } }) as RedisClientType;
      await client.connect();
      await client.ping();
      await client.disconnect();

      return this.getStatus(key, true, { host, port });
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${(error as Error).message}`);
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { host, port, error: (error as Error).message }),
      );
    } finally {
      if (client?.isOpen) {
        await client.disconnect().catch(() => undefined);
      }
    }
  }
}
