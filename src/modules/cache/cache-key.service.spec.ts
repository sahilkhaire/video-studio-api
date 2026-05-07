import { Test, TestingModule } from '@nestjs/testing';
import { CacheKeyService } from './cache-key.service';

describe('CacheKeyService', () => {
  let service: CacheKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheKeyService],
    }).compile();

    service = module.get<CacheKeyService>(CacheKeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forScript', () => {
    it('should return a key prefixed with "script:"', () => {
      // Act
      const key = service.forScript({ topic: 'test' });

      // Assert
      expect(key.startsWith('script:')).toBe(true);
    });

    it('should produce the same key for identical requests', () => {
      // Arrange
      const req = { topic: 'photosynthesis', platform: 'youtube' };

      // Act & Assert
      expect(service.forScript(req)).toBe(service.forScript(req));
    });

    it('should produce different keys for different requests', () => {
      // Act
      const key1 = service.forScript({ topic: 'cats' });
      const key2 = service.forScript({ topic: 'dogs' });

      // Assert
      expect(key1).not.toBe(key2);
    });
  });

  describe('forImage', () => {
    it('should return a key prefixed with "image:"', () => {
      expect(service.forImage({ prompt: 'sunset' }).startsWith('image:')).toBe(true);
    });

    it('should produce different keys from forScript for the same input', () => {
      const input = { topic: 'test' };
      expect(service.forScript(input)).not.toBe(service.forImage(input));
    });
  });

  describe('forAudio', () => {
    it('should return a key prefixed with "audio:"', () => {
      expect(service.forAudio({ text: 'hello world' }).startsWith('audio:')).toBe(true);
    });
  });
});
