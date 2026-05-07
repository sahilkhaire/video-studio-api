import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContentCacheService } from './content-cache.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockRedis = require('ioredis');

jest.mock('ioredis');

describe('ContentCacheService', () => {
  let service: ContentCacheService;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockDel: jest.Mock;
  let mockQuit: jest.Mock;
  let mockOn: jest.Mock;

  const mockConfigService = {
    get: jest.fn().mockImplementation((_key: string, defaultVal: unknown) => defaultVal),
  };

  beforeEach(async () => {
    mockGet = jest.fn();
    mockSet = jest.fn();
    mockDel = jest.fn();
    mockQuit = jest.fn().mockResolvedValue('OK');
    mockOn = jest.fn();

    mockRedis.mockImplementation(() => ({
      get: mockGet,
      set: mockSet,
      del: mockDel,
      quit: mockQuit,
      on: mockOn,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentCacheService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<ContentCacheService>(ContentCacheService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return null when key does not exist', async () => {
      // Arrange
      mockGet.mockResolvedValue(null);

      // Act
      const result = await service.get('missing-key');

      // Assert
      expect(result).toBeNull();
    });

    it('should return parsed JSON when key exists', async () => {
      // Arrange
      const payload = { title: 'cached script' };
      mockGet.mockResolvedValue(JSON.stringify(payload));

      // Act
      const result = await service.get<typeof payload>('script:abc');

      // Assert
      expect(result).toEqual(payload);
    });

    it('should return null and swallow error on Redis failure', async () => {
      // Arrange
      mockGet.mockRejectedValue(new Error('Redis down'));

      // Act
      const result = await service.get('any-key');

      // Assert — no throw, gracefully returns null
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should call redis.set with EX ttl', async () => {
      // Arrange
      mockSet.mockResolvedValue('OK');
      const value = { url: 'https://example.com/img.png' };

      // Act
      await service.set('image:xyz', value, 3600);

      // Assert
      expect(mockSet).toHaveBeenCalledWith('image:xyz', JSON.stringify(value), 'EX', 3600);
    });

    it('should swallow error on Redis failure', async () => {
      // Arrange
      mockSet.mockRejectedValue(new Error('Redis down'));

      // Act & Assert — no throw
      await expect(service.set('key', { data: 1 }, 60)).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('should call redis.del with the given key', async () => {
      // Arrange
      mockDel.mockResolvedValue(1);

      // Act
      await service.del('script:abc');

      // Assert
      expect(mockDel).toHaveBeenCalledWith('script:abc');
    });

    it('should swallow error on Redis failure', async () => {
      // Arrange
      mockDel.mockRejectedValue(new Error('Redis down'));

      // Act & Assert — no throw
      await expect(service.del('key')).resolves.toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call redis.quit on destroy', async () => {
      // Act
      await service.onModuleDestroy();

      // Assert
      expect(mockQuit).toHaveBeenCalledTimes(1);
    });
  });
});
