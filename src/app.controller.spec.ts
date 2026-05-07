import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                NODE_ENV: 'test',
                PORT: 3000,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('getInfo', () => {
    it('should return API information', () => {
      // Arrange
      const expectedInfo = {
        message: 'Video Generation API',
        version: '0.1.0',
      };

      // Act
      const result = controller.getInfo();

      // Assert
      expect(result).toEqual(expectedInfo);
      expect(result.message).toBe('Video Generation API');
      expect(result.version).toBe('0.1.0');
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.environment).toBe('test');
    });

    it('should have valid timestamp format', () => {
      // Act
      const result = controller.getHealth();

      // Assert
      const timestamp = new Date(result.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });
});
