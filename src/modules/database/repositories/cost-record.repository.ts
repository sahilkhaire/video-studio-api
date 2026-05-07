import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CostRecord, CostRecordDocument } from '../schemas/cost-record.schema';
import { IProviderCallRecord, ContentType } from '../../../domain/interfaces/cost-tracking.interface';

@Injectable()
export class CostRecordRepository {
  constructor(
    @InjectModel(CostRecord.name)
    private readonly model: Model<CostRecordDocument>,
  ) {}

  async save(record: IProviderCallRecord): Promise<void> {
    await this.model.create({
      recordId: record.id,
      provider: record.provider,
      contentType: record.contentType,
      estimatedCostUsd: record.estimatedCostUsd,
      durationMs: record.durationMs,
      success: record.success,
      timestamp: record.timestamp,
    });
  }

  async findAll(): Promise<CostRecordDocument[]> {
    return this.model.find().sort({ timestamp: -1 }).exec();
  }

  async findSince(since: Date): Promise<CostRecordDocument[]> {
    return this.model.find({ timestamp: { $gte: since } }).sort({ timestamp: -1 }).exec();
  }

  async findByProvider(provider: string): Promise<CostRecordDocument[]> {
    return this.model.find({ provider }).sort({ timestamp: -1 }).exec();
  }

  async findByContentType(contentType: ContentType): Promise<CostRecordDocument[]> {
    return this.model.find({ contentType }).sort({ timestamp: -1 }).exec();
  }

  async deleteAll(): Promise<void> {
    await this.model.deleteMany({}).exec();
  }

  async getTotalCostSince(since: Date): Promise<number> {
    const result = await this.model.aggregate<{ total: number }>([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$estimatedCostUsd' } } },
    ]);
    return result[0]?.total ?? 0;
  }
}
