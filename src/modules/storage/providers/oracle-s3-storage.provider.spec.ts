import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OracleS3StorageProvider } from './oracle-s3-storage.provider';

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
      'https://my-ns.compat.objectstorage.us-ashburn-1.oraclecloud.com/test-bucket/videos/test.mp4?signed=1',
    ),
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

describe('OracleS3StorageProvider', () => {
  let provider: OracleS3StorageProvider;
  let mockS3Send: jest.Mock;

  const buildModule = async (
    extraConfig: Record<string, string> = {},
  ): Promise<OracleS3StorageProvider> => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    mockS3Send = jest.fn().mockResolvedValue({});
    S3Client.mockImplementation(() => ({ send: mockS3Send }));

    const baseConfig: Record<string, string> = {
      OCI_NAMESPACE: 'my-ns',
      OCI_REGION: 'us-ashburn-1',
      OCI_S3_ACCESS_KEY: 'oci-key-id',
      OCI_S3_SECRET_KEY: 'oci-secret-key',
      OCI_S3_BUCKET: 'test-bucket',
      ...extraConfig,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleS3StorageProvider,
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

    return module.get<OracleS3StorageProvider>(OracleS3StorageProvider);
  };

  beforeEach(async () => {
    provider = await buildModule();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should return provider name "oracle_s3"', () => {
    expect(provider.getProviderName()).toBe('oracle_s3');
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

      // Assert — no ACL field
      const putArgs = PutObjectCommand.mock.calls[0][0] as Record<string, unknown>;
      expect(putArgs).not.toHaveProperty('ACL');
      expect(result.key).toBe('videos/test.mp4');
      expect(result.fileSize).toBe(4096);
      expect(result.contentType).toBe('video/mp4');
    });

    it('should return a signed URL when OCI_S3_PUBLIC_URL is not set', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/private.mp4',
        sourcePath: '/tmp/private.mp4',
        isPublic: false,
      });

      // Assert
      expect(result.url).toContain('oraclecloud.com');
    });

    it('should return a public URL when isPublic is true and OCI_S3_PUBLIC_URL is set', async () => {
      // Arrange
      provider = await buildModule({ OCI_S3_PUBLIC_URL: 'https://cdn.example.com' });

      // Act
      const result = await provider.upload({
        key: 'videos/public.mp4',
        sourcePath: '/tmp/public.mp4',
        isPublic: true,
      });

      // Assert
      expect(result.url).toBe('https://cdn.example.com/videos/public.mp4');
    });

    it('should fall back to signed URL when isPublic is true but OCI_S3_PUBLIC_URL is not set', async () => {
      // Act
      const result = await provider.upload({
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
        isPublic: true,
      });

      // Assert
      expect(result.url).toContain('oraclecloud.com');
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
    it('should return a pre-signed URL containing the Oracle endpoint', async () => {
      // Act
      const url = await provider.getUrl('videos/test.mp4', 600);

      // Assert
      expect(url).toContain('oraclecloud.com');
    });
  });

  describe('download', () => {
    it('should throw when Oracle S3 returns empty body', async () => {
      // Arrange
      mockS3Send.mockResolvedValueOnce({ Body: null });

      // Act & Assert
      await expect(provider.download('videos/test.mp4', '/tmp/out.mp4')).rejects.toThrow(
        'empty body',
      );
    });

    it('should stream the Oracle S3 body to the destination', async () => {
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
