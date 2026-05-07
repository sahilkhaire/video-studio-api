import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';

// Mock all fs and stream operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 2048 }),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
  createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  createWriteStream: jest.fn().mockReturnValue({ on: jest.fn() }),
}));

jest.mock('stream/promises', () => ({
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: string) => {
              if (key === 'video.storage.localPath') return '/storage';
              return def;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<LocalStorageProvider>(LocalStorageProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return provider name "local"', () => {
    expect(provider.getProviderName()).toBe('local');
  });

  describe('upload', () => {
    it('should copy file and return stored file metadata', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
        contentType: 'video/mp4',
      });

      // Assert
      expect(result.key).toBe('videos/test.mp4');
      expect(result.fileSize).toBe(2048);
      expect(result.contentType).toBe('video/mp4');
      expect(result.url).toContain('videos/test.mp4');
      expect(result.uploadedAt).toBeInstanceOf(Date);
    });

    it('should default contentType to application/octet-stream when not provided', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
      });

      // Assert
      expect(result.contentType).toBe('application/octet-stream');
    });
  });

  describe('getUrl', () => {
    it('should return the full local path', async () => {
      // Act
      const url = await provider.getUrl('videos/test.mp4');

      // Assert
      expect(url).toContain('videos/test.mp4');
    });
  });

  describe('delete', () => {
    it('should call unlink on the correct path', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fsMock = require('fs');

      // Act
      await provider.delete('videos/test.mp4');

      // Assert
      expect(fsMock.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('videos/test.mp4'),
      );
    });
  });
});
