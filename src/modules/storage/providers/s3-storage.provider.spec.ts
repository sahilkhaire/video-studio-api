import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './s3-storage.provider';

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
    .mockResolvedValue('https://s3.amazonaws.com/test-bucket/videos/test.mp4?signed=1'),
}));

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn().mockResolvedValue({ size: 4096 }),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
  createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  createWriteStream: jest.fn().mockReturnValue({ on: jest.fn() }),
}));

jest.mock('stream/promises', () => ({
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;
  let mockS3Send: jest.Mock;

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    mockS3Send = jest.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({ send: mockS3Send }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: string) => {
              const config: Record<string, string> = {
                AWS_REGION: 'us-east-1',
                AWS_S3_BUCKET: 'test-bucket',
                AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
                AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
              };
              return config[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<S3StorageProvider>(S3StorageProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return provider name "s3"', () => {
    expect(provider.getProviderName()).toBe('s3');
  });

  describe('upload', () => {
    it('should call S3 PutObjectCommand and return stored file metadata', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
        contentType: 'video/mp4',
      });

      // Assert
      expect(mockS3Send).toHaveBeenCalledTimes(1); // PutObjectCommand only
      expect(result.key).toBe('videos/test.mp4');
      expect(result.fileSize).toBe(4096);
      expect(result.contentType).toBe('video/mp4');
    });

    it('should return a public URL when isPublic is true', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/public.mp4',
        sourcePath: '/tmp/public.mp4',
        isPublic: true,
      });

      // Assert
      expect(result.url).toContain('test-bucket');
      expect(result.url).toContain('videos/public.mp4');
      expect(mockS3Send).toHaveBeenCalledTimes(1); // only PutObject
    });
  });

  describe('delete', () => {
    it('should call S3 DeleteObjectCommand', async () => {
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
      expect(url).toContain('s3.amazonaws.com');
    });
  });

  describe('download', () => {
    it('should throw when S3 returns empty body', async () => {
      // Arrange
      mockS3Send.mockResolvedValueOnce({ Body: null });

      // Act & Assert
      await expect(provider.download('videos/test.mp4', '/tmp/out.mp4')).rejects.toThrow(
        'empty body',
      );
    });

    it('should stream the S3 body to the destination', async () => {
      // Arrange
      const mockBody = { pipe: jest.fn() };
      mockS3Send.mockResolvedValueOnce({ Body: mockBody });

      // Act
      await provider.download('videos/test.mp4', '/tmp/out.mp4');

      // Assert — pipeline was called (mocked to resolve)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pipeline } = require('stream/promises');
      expect(pipeline).toHaveBeenCalled();
    });
  });
});
