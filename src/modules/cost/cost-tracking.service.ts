import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ContentType,
  ICostSummary,
  IProviderCallRecord,
  IProviderCostSummary,
} from '../../domain/interfaces/cost-tracking.interface';
import { CostRecordRepository } from '../database/repositories/cost-record.repository';

@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);
  private readonly records: IProviderCallRecord[] = [];
  private readonly trackedSince = new Date();

  constructor(private readonly costRecordRepository: CostRecordRepository) {}

  recordCall(record: Omit<IProviderCallRecord, 'id'>): IProviderCallRecord {
    const full: IProviderCallRecord = { ...record, id: uuidv4() };
    this.records.push(full);
    // Persist async — do not block the caller
    this.costRecordRepository.save(full).catch((err: Error) => {
      this.logger.warn(`Failed to persist cost record to MongoDB: ${err.message}`);
    });
    return full;
  }

  getRecords(): IProviderCallRecord[] {
    return [...this.records];
  }

  getSummary(): ICostSummary {
    const byKey = new Map<string, IProviderCostSummary>();

    for (const record of this.records) {
      const key = `${record.provider}:${record.contentType}`;
      let entry = byKey.get(key);

      if (!entry) {
        entry = {
          provider: record.provider,
          contentType: record.contentType as ContentType,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalEstimatedCostUsd: 0,
          averageEstimatedCostUsd: 0,
          averageDurationMs: 0,
        };
      }

      entry.totalCalls++;
      if (record.success) {
        entry.successfulCalls++;
      } else {
        entry.failedCalls++;
      }
      entry.totalEstimatedCostUsd += record.estimatedCostUsd;
      entry.averageEstimatedCostUsd = entry.totalEstimatedCostUsd / entry.totalCalls;
      entry.averageDurationMs =
        (entry.averageDurationMs * (entry.totalCalls - 1) + record.durationMs) / entry.totalCalls;

      byKey.set(key, entry);
    }

    return {
      totalEstimatedCostUsd: this.records.reduce((sum, r) => sum + r.estimatedCostUsd, 0),
      totalCalls: this.records.length,
      byProvider: Array.from(byKey.values()),
      trackedSince: this.trackedSince,
    };
  }

  reset(): void {
    this.records.length = 0;
    this.costRecordRepository.deleteAll().catch((err: Error) => {
      this.logger.warn(`Failed to reset cost records in MongoDB: ${err.message}`);
    });
  }
}
