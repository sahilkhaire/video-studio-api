// Job and Video Generation Types
export interface GenerateVideoRequest {
  topic: string;
  duration?: number;
  style?: string;
  provider?: string;
}

export interface GenerateFromImagesRequest {
  imageUrls: string[];
  duration?: number;
  ttsProvider?: string;
  ttsVoice?: string;
}

export interface GenerateMusicVideoRequest {
  musicFile: File;
  prompt?: string;
  duration?: number;
}

export interface VideoJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  result?: {
    videoUrl: string;
    duration: number;
    size: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Provider Types
export interface Provider {
  id: string;
  name: string;
  type: string;
  active: boolean;
  models?: string[];
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
}

// Cost Types
export interface CostSummary {
  totalCost: number;
  currency: string;
  breakdown: {
    [provider: string]: number;
  };
  jobCount: number;
}

// Health Types
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
  services?: {
    [service: string]: 'up' | 'down';
  };
}

// Mongo Debug Types
export interface MongoDetails {
  collections: {
    [name: string]: {
      count: number;
      sample?: Record<string, unknown>;
    };
  };
  costRecords?: Array<{
    jobId: string;
    cost: number;
    provider: string;
    date: string;
  }>;
}
