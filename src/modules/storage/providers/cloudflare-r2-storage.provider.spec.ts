import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ Body: null }),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue(
      'https://abc123.r2.cloudflarestorage.com/test-bucket/videos/test.mp4?signed=1',
    ),
}));

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn().mockResolvedValue({ size: 8192 }),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
  createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  createWriteStream: jest.fn().mockReturnValue({ on: jest.fn() }),
}));

jest.mock('stream/promises', () => ({
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

describe('CloudflareR2StorageProvider', () => {
  let provider: CloudflareR2StorageProvider;
  let mockS3Send: jest.Mock;

  const buildModule = async (extraConfig: Record<string, string> = {}) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    mockS3Send = jest.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({ send: mockS3Send }));

    const baseConfig: Record<string, string> = {
      CF_ACCOUNT_ID: 'abc123',
      CF_R2_ACCESS_KEY_ID: 'r2-key-id',
      CF_R2_SECRET_ACCESS_KEY: 'r2-secret-key',
      CF_R2_BUCKET: 'test-bucket',
      ...extraConfig,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudflareR2StorageProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: string) => {
              return baseConfig[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    return module.get<CloudflareR2StorageProvider>(CloudflareR2StorageProvider);
  };

  beforeEach(async () => {
    provider = await buildModule();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return provider name "cloudflare_r2"', () => {
    expect(provider.getProviderName()).toBe('cloudflare_r2');
  });

  describe('upload', () => {
    it('should call PutObjectCommand without ACL and return stored file metadata', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PutObjectCommand } = require('@aws-sdk/client-s3');

      // Act
      const result = await provider.upload({
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
        contentType: 'video/mp4',
      });

      // Assert — no ACL field in PutObjectCommand call
      const putArgs = PutObjectCommand.mock.calls[0][0] as Record<string, unknown>;
      expect(putArgs).not.toHaveProperty('ACL');
      expect(result.key).toBe('videos/test.mp4');
      expect(result.fileSize).toBe(8192);
      expect(result.contentType).toBe('video/mp4');
    });

    it('should return a signed URL when isPublic is false and no CF_R2_PUBLIC_URL', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/private.mp4',
        sourcePath: '/tmp/private.mp4',
        isPublic: false,
      });

      // Assert — falls back to signed URL
      expect(result.url).toContain('r2.cloudflarestorage.com');
    });

    it('should return a public URL when isPublic is true and CF_R2_PUBLIC_URL is set', async () => {
      // Arrange — rebuild with public URL configured
      provider = await buildModule({ CF_R2_PUBLIC_URL: 'https://assets.example.com' });

      // Act
      const result = await provider.upload({
        key: 'videos/public.mp4',
        sourcePath: '/tmp/public.mp4',
        isPublic: true,
      });

      // Assert
      expect(result.url).toBe('https://assets.example.com/videos/public.mp4');
    });

    it('should fall back to signed URL when isPublic is true but CF_R2_PUBLIC_URL is not set', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
        isPublic: true,
      });

      // Assert — no publicUrl → signed URL
      expect(result.url).toContain('r2.cloudflarestorage.com');
    });
  });

  describe('delete', () => {
    it('should call DeleteObjectCommand', async () => {
      // Act
      await provider.delete('videos/test.mp4');

      // Assert
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUrl', () => {
    it('should return a pre-signed URL', async () => {
      // Act
      const url = await provider.getUrl('videos/test.mp4', 600);

      // Assert
      expect(url).toContain('r2.cloudflarestorage.com');
    });
  });

  describe('download', () => {
    it('should throw when R2 returns empty body', async () => {
      // Arrange
      mockS3Send.mockResolvedValueOnce({ Body: null });

      // Act & Assert
      await expect(provider.download('videos/test.mp4', '/tmp/out.mp4')).rejects.toThrow(
        'empty body',
      );
    });

    it('should stream the R2 body to the destination', async () => {
      // Arrange
      const mockBody = { pipe: jest.fn() };
      mockS3Send.mockResolvedValueOnce({ Body: mockBody });

      // Act
      await provider.download('videos/test.mp4', '/tmp/out.mp4');

      // Assert
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pipeline } = require('stream/promises');
      expect(pipeline).toHaveBeenCalled();
    });
  });
});
