import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ContentType } from '../../../domain/interfaces/cost-tracking.interface';

export type CostRecordDocument = HydratedDocument<CostRecord>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'cost_records' })
export class CostRecord {
  @Prop({ required: true })
  recordId!: string;

  @Prop({ required: true, index: true })
  provider!: string;

  @Prop({ required: true, enum: ContentType, index: true })
  contentType!: ContentType;

  @Prop({ required: true, default: 0 })
  estimatedCostUsd!: number;

  @Prop({ required: true })
  durationMs!: number;

  @Prop({ required: true })
  success!: boolean;

  @Prop({ required: true, index: true })
  timestamp!: Date;
}

export const CostRecordSchema = SchemaFactory.createForClass(CostRecord);

// Index for time-range cost queries
CostRecordSchema.index({ timestamp: -1 });
CostRecordSchema.index({ provider: 1, contentType: 1, timestamp: -1 });
