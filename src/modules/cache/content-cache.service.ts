import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ContentCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContentCacheService.name);
  private redis!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    this.redis = new Redis({ host, port, lazyConnect: true });
    this.redis.on('error', (err: Error) => {
      this.logger.warn(`Cache Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Cache get failed for key ${key}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      this.logger.warn(`Cache set failed for key ${key}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      this.logger.warn(`Cache del failed for key ${key}`);
    }
  }
}
