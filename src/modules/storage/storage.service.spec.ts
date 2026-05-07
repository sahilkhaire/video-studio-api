import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  IStoredFile,
} from '../../domain/interfaces/storage-provider.interface';

describe('StorageService', () => {
  let service: StorageService;
  let mockProvider: jest.Mocked<IStorageProvider>;

  const storedFile: IStoredFile = {
    key: 'videos/test.mp4',
    url: '/storage/videos/test.mp4',
    fileSize: 2048,
    contentType: 'video/mp4',
    uploadedAt: new Date(),
  };

  beforeEach(async () => {
    mockProvider = {
      upload: jest.fn().mockResolvedValue(storedFile),
      download: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getUrl: jest.fn().mockResolvedValue('/storage/videos/test.mp4'),
      getProviderName: jest.fn().mockReturnValue('local'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService, { provide: STORAGE_PROVIDER, useValue: mockProvider }],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return active provider name', () => {
    expect(service.getActiveProvider()).toBe('local');
  });

  describe('upload', () => {
    it('should delegate to provider and return stored file', async () => {
      // Arrange
      const options = {
        key: 'videos/test.mp4',
        sourcePath: '/tmp/test.mp4',
        contentType: 'video/mp4',
      };

      // Act
      const result = await service.upload(options);

      // Assert
      expect(mockProvider.upload).toHaveBeenCalledWith(options);
      expect(result).toEqual(storedFile);
    });
  });

  describe('download', () => {
    it('should delegate to provider', async () => {
      // Act
      await service.download('videos/test.mp4', '/tmp/out.mp4');

      // Assert
      expect(mockProvider.download).toHaveBeenCalledWith('videos/test.mp4', '/tmp/out.mp4');
    });
  });

  describe('delete', () => {
    it('should delegate to provider', async () => {
      // Act
      await service.delete('videos/test.mp4');

      // Assert
      expect(mockProvider.delete).toHaveBeenCalledWith('videos/test.mp4');
    });
  });

  describe('getUrl', () => {
    it('should delegate to provider with expiry', async () => {
      // Act
      const url = await service.getUrl('videos/test.mp4', 600);

      // Assert
      expect(mockProvider.getUrl).toHaveBeenCalledWith('videos/test.mp4', 600);
      expect(url).toBe('/storage/videos/test.mp4');
    });
  });
});
