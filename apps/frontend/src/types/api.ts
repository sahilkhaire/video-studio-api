// Job and Video Generation Types
export interface GenerateVideoRequest {
  topic: string;
  platform: 'youtube' | 'instagram_reels' | 'tiktok';
  style?: string;
  targetDuration: number;
  targetAudience?: string;
  additionalContext?: string;
  resolution?: '480p' | '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  fps?: number;
  scriptProvider?: string;
  imageProvider?: string;
  ttsProvider?: string;
  voice?: string;
  showCaptions?: boolean;
  callbackUrl?: string;
}

export interface GenerateFromImagesRequest {
  data: Array<{
    content: string;
    images: string[];
  }>;
  showCaptions?: boolean;
  showCaption?: boolean;
  voice?: string;
  style?: string;
  resolution?: '480p' | '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  fps?: number;
  ttsProvider?: string;
  callbackUrl?: string;
}

export interface GenerateMusicVideoRequest {
  topic: string;
  lyrics?: string;
  musicFile?: File;
  musicPath?: string;
  musicUrl?: string;
  additionalContext?: string;
  style?: string;
  scriptProvider?: string;
  imageProvider?: string;
  imageModel?: string;
  youtubeResolution?: '480p' | '720p' | '1080p';
  reelsResolution?: '480p' | '720p' | '1080p';
  fps?: number;
  callbackUrl?: string;
}

export interface VideoJob {
  jobId: string;
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'waiting'
    | 'active'
    | 'delayed';
  progress?: number;
  error?: string;
  result?: {
    videoUrl?: string;
    duration?: number;
    size?: number;
    error?: string;
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

// Provider Models Types
export interface ProviderModel {
  id: string;
  name: string;
  displayName: string;
  isDefault?: boolean;
}

export interface ProviderOption {
  name: string;
  displayName: string;
  description?: string;
  isDefault?: boolean;
  models: ProviderModel[];
}

export interface ProviderToolGroup {
  id: 'script' | 'image' | 'tts';
  displayName: string;
  description: string;
  providers: ProviderOption[];
}

export interface ProvidersModels {
  version?: string;
  generatedAt?: string;
  defaults?: {
    script?: { provider: string; model: string };
    image?: { provider: string; model: string };
    tts?: { provider: string; model: string };
  };
  tools?: ProviderToolGroup[];
  script: ProviderOption[];
  image: ProviderOption[];
  tts: ProviderOption[];
}
