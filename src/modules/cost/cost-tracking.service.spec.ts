import { Test, TestingModule } from '@nestjs/testing';
import { CostTrackingService } from './cost-tracking.service';
import { ContentType } from '../../domain/interfaces/cost-tracking.interface';
import { CostRecordRepository } from '../database/repositories/cost-record.repository';

const makeRecord = (
  overrides: Partial<{
    provider: string;
    contentType: ContentType;
    estimatedCostUsd: number;
    durationMs: number;
    success: boolean;
  }> = {},
): {
  provider: string;
  contentType: ContentType;
  estimatedCostUsd: number;
  durationMs: number;
  success: boolean;
  timestamp: Date;
} => ({
  provider: 'openai',
  contentType: ContentType.SCRIPT,
  estimatedCostUsd: 0.05,
  durationMs: 1000,
  success: true,
  timestamp: new Date(),
  ...overrides,
});

describe('CostTrackingService', () => {
  let service: CostTrackingService;
  let mockCostRecordRepository: { save: jest.Mock; deleteAll: jest.Mock };

  beforeEach(async () => {
    mockCostRecordRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      deleteAll: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostTrackingService,
        { provide: CostRecordRepository, useValue: mockCostRecordRepository },
      ],
    }).compile();

    service = module.get<CostTrackingService>(CostTrackingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordCall', () => {
    it('should persist a call and return it with a uuid id', () => {
      // Act
      const result = service.recordCall(makeRecord());

      // Assert
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
      expect(result.provider).toBe('openai');
      expect(result.estimatedCostUsd).toBe(0.05);
    });
  });

  describe('getRecords', () => {
    it('should return a defensive copy of recorded calls', () => {
      // Arrange
      service.recordCall(makeRecord());

      // Act
      const records = service.getRecords();
      records.pop();

      // Assert — internal state unchanged
      expect(service.getRecords()).toHaveLength(1);
    });
  });

  describe('getSummary', () => {
    it('should return zero totals when no calls are recorded', () => {
      // Act
      const summary = service.getSummary();

      // Assert
      expect(summary.totalCalls).toBe(0);
      expect(summary.totalEstimatedCostUsd).toBe(0);
      expect(summary.byProvider).toHaveLength(0);
      expect(summary.trackedSince).toBeInstanceOf(Date);
    });

    it('should aggregate calls by provider+contentType combination', () => {
      // Arrange
      service.recordCall(
        makeRecord({
          provider: 'openai',
          contentType: ContentType.SCRIPT,
          estimatedCostUsd: 0.05,
          durationMs: 1000,
        }),
      );
      service.recordCall(
        makeRecord({
          provider: 'openai',
          contentType: ContentType.SCRIPT,
          estimatedCostUsd: 0.05,
          durationMs: 2000,
        }),
      );
      service.recordCall(
        makeRecord({
          provider: 'dalle',
          contentType: ContentType.IMAGE,
          estimatedCostUsd: 0.04,
          durationMs: 3000,
          success: false,
        }),
      );

      // Act
      const summary = service.getSummary();

      // Assert
      expect(summary.totalCalls).toBe(3);
      expect(summary.totalEstimatedCostUsd).toBeCloseTo(0.14);
      expect(summary.byProvider).toHaveLength(2);
    });

    it('should correctly count successes and failures', () => {
      // Arrange
      service.recordCall(makeRecord({ success: true }));
      service.recordCall(makeRecord({ success: false }));

      // Act
      const summary = service.getSummary();
      const entry = summary.byProvider[0];

      // Assert
      expect(entry.successfulCalls).toBe(1);
      expect(entry.failedCalls).toBe(1);
      expect(entry.totalCalls).toBe(2);
    });

    it('should compute correct average duration and cost', () => {
      // Arrange
      service.recordCall(makeRecord({ estimatedCostUsd: 0.04, durationMs: 1000 }));
      service.recordCall(makeRecord({ estimatedCostUsd: 0.06, durationMs: 3000 }));

      // Act
      const summary = service.getSummary();
      const entry = summary.byProvider[0];

      // Assert
      expect(entry.averageEstimatedCostUsd).toBeCloseTo(0.05);
      expect(entry.averageDurationMs).toBeCloseTo(2000);
    });
  });

  describe('reset', () => {
    it('should clear all recorded calls', () => {
      // Arrange
      service.recordCall(makeRecord());
      service.recordCall(makeRecord());

      // Act
      service.reset();

      // Assert
      expect(service.getRecords()).toHaveLength(0);
      expect(service.getSummary().totalCalls).toBe(0);
    });
  });
});
