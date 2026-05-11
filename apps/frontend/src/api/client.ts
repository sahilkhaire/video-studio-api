import axios, { AxiosInstance } from 'axios';
import {
  GenerateVideoRequest,
  GenerateFromImagesRequest,
  GenerateMusicVideoRequest,
  VideoJob,
  Provider,
  TTSVoice,
  CostSummary,
  HealthStatus,
  MongoDetails,
} from '../types/api';

class APIClient {
  private client: AxiosInstance;

  private normalizeVideoJob(payload: unknown): VideoJob {
    const now = new Date().toISOString();

    if (!this.isRecord(payload)) {
      return {
        jobId: `job-${Date.now()}`,
        status: 'processing',
        createdAt: now,
        updatedAt: now,
      };
    }

    if (typeof payload.jobId === 'string' && typeof payload.status === 'string') {
      return {
        jobId: payload.jobId,
        status: payload.status as VideoJob['status'],
        progress: typeof payload.progress === 'number' ? payload.progress : undefined,
        error: typeof payload.error === 'string' ? payload.error : undefined,
        result: this.isRecord(payload.result)
          ? {
              videoUrl:
                typeof payload.result.videoUrl === 'string'
                  ? payload.result.videoUrl
                  : undefined,
              duration:
                typeof payload.result.duration === 'number'
                  ? payload.result.duration
                  : undefined,
              size:
                typeof payload.result.size === 'number' ? payload.result.size : undefined,
            }
          : undefined,
        createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : now,
        updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now,
      };
    }

    // Direct generation shape (generate-from-content-images) returns a video object.
    if (this.isRecord(payload.video)) {
      return {
        jobId: `direct-${Date.now()}`,
        status: 'completed',
        result: {
          videoUrl:
            typeof payload.video.videoPath === 'string' ? payload.video.videoPath : undefined,
          duration: typeof payload.video.duration === 'number' ? payload.video.duration : undefined,
          size: typeof payload.video.fileSize === 'number' ? payload.video.fileSize : undefined,
        },
        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      jobId: `job-${Date.now()}`,
      status: 'processing',
      createdAt: now,
      updatedAt: now,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private normalizeProviders(payload: unknown): Provider[] {
    if (Array.isArray(payload)) {
      return payload as Provider[];
    }

    if (!this.isRecord(payload)) {
      return [];
    }

    // Backend shape: { script: string, image: string, tts: string }
    const providerTypes = ['script', 'image', 'tts'] as const;
    const providers: Provider[] = [];
    for (const type of providerTypes) {
      const value = payload[type];
      if (typeof value !== 'string' || !value.trim()) {
        continue;
      }

      providers.push({
        id: `${type}-${value}`,
        name: value,
        type,
        active: true,
        models: [],
      });
    }

    // Some deployments may still wrap results.
    if (providers.length > 0) {
      return providers;
    }

    const wrapped = ['providers', 'items', 'data', 'results']
      .map((key) => payload[key])
      .find((value) => Array.isArray(value));

    return Array.isArray(wrapped) ? (wrapped as Provider[]) : [];
  }

  private normalizeCostSummary(payload: unknown): CostSummary {
    if (!this.isRecord(payload)) {
      return {
        totalCost: 0,
        currency: 'USD',
        breakdown: {},
        jobCount: 0,
      };
    }

    // Frontend-native shape passthrough.
    if (
      typeof payload.totalCost === 'number' &&
      typeof payload.currency === 'string' &&
      this.isRecord(payload.breakdown) &&
      typeof payload.jobCount === 'number'
    ) {
      return {
        totalCost: payload.totalCost,
        currency: payload.currency,
        breakdown: payload.breakdown as Record<string, number>,
        jobCount: payload.jobCount,
      };
    }

    // Backend shape: ICostSummary
    const byProvider = Array.isArray(payload.byProvider) ? payload.byProvider : [];
    const aggregated = byProvider.reduce<Record<string, number>>((acc, item) => {
      if (!this.isRecord(item)) {
        return acc;
      }

      const provider = item.provider;
      const cost = item.totalEstimatedCostUsd;
      if (typeof provider !== 'string' || typeof cost !== 'number') {
        return acc;
      }

      acc[provider] = (acc[provider] ?? 0) + cost;
      return acc;
    }, {});

    return {
      totalCost:
        typeof payload.totalEstimatedCostUsd === 'number' ? payload.totalEstimatedCostUsd : 0,
      currency: 'USD',
      breakdown: aggregated,
      jobCount: typeof payload.totalCalls === 'number' ? payload.totalCalls : 0,
    };
  }

  private normalizeHealth(payload: unknown): HealthStatus {
    if (!this.isRecord(payload)) {
      return {
        status: 'down',
        uptime: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const timestamp =
      typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString();
    const uptime = typeof payload.uptime === 'number' ? payload.uptime : 0;

    // AppController shape
    if (payload.status === 'ok' || payload.status === 'degraded' || payload.status === 'down') {
      return {
        status: payload.status,
        uptime,
        timestamp,
        services: this.isRecord(payload.services)
          ? (payload.services as HealthStatus['services'])
          : undefined,
      };
    }

    // Terminus shape: { status: 'ok' | 'error', details: { redis: { status: 'up' | 'down' } } }
    const details = this.isRecord(payload.details) ? payload.details : {};
    const services = Object.entries(details).reduce<Record<string, 'up' | 'down'>>(
      (acc, [serviceName, serviceDetails]) => {
        if (!this.isRecord(serviceDetails)) {
          return acc;
        }

        const status = serviceDetails.status;
        if (status === 'up' || status === 'down') {
          acc[serviceName] = status;
        }

        return acc;
      },
      {}
    );

    const status = payload.status === 'ok' ? 'ok' : payload.status === 'error' ? 'down' : 'degraded';

    return {
      status,
      uptime,
      timestamp,
      services,
    };
  }

  private normalizeMongoDetails(payload: unknown): MongoDetails {
    if (!this.isRecord(payload)) {
      return {
        collections: {},
        costRecords: [],
      };
    }

    // Frontend-native shape passthrough.
    if (this.isRecord(payload.collections)) {
      const incomingCollections = payload.collections;
      const normalizedCollections = Object.entries(incomingCollections).reduce<
        MongoDetails['collections']
      >((acc, [key, value]) => {
        if (!this.isRecord(value)) {
          return acc;
        }

        const count = typeof value.count === 'number' ? value.count : 0;
        const sample = this.isRecord(value.sample) ? value.sample : undefined;
        acc[key] = { count, sample };
        return acc;
      }, {});

      const incomingCostRecords = Array.isArray(payload.costRecords) ? payload.costRecords : [];
      const normalizedCostRecords = incomingCostRecords
        .filter((record) => this.isRecord(record))
        .map((record) => ({
          jobId: typeof record.jobId === 'string' ? record.jobId : 'unknown',
          cost: typeof record.cost === 'number' ? record.cost : 0,
          provider: typeof record.provider === 'string' ? record.provider : 'unknown',
          date: typeof record.date === 'string' ? record.date : new Date().toISOString(),
        }));

      return {
        collections: normalizedCollections,
        costRecords: normalizedCostRecords,
      };
    }

    const videoJobs = Array.isArray(payload.videoJobs) ? payload.videoJobs : [];
    const costRecords = Array.isArray(payload.costRecords) ? payload.costRecords : [];

    const normalizedCostRecords = costRecords
      .filter((record) => this.isRecord(record))
      .map((record) => ({
        jobId:
          typeof record.recordId === 'string'
            ? record.recordId
            : typeof record.jobId === 'string'
              ? record.jobId
              : 'unknown',
        cost: typeof record.estimatedCostUsd === 'number' ? record.estimatedCostUsd : 0,
        provider: typeof record.provider === 'string' ? record.provider : 'unknown',
        date:
          typeof record.timestamp === 'string'
            ? record.timestamp
            : new Date().toISOString(),
      }));

    return {
      collections: {
        videoJobs: {
          count: videoJobs.length,
          sample: videoJobs[0] as Record<string, unknown> | undefined,
        },
        costRecords: {
          count: costRecords.length,
          sample: costRecords[0] as Record<string, unknown> | undefined,
        },
      },
      costRecords: normalizedCostRecords,
    };
  }

  constructor() {
    const baseURL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api';
    const apiKey = (import.meta.env.VITE_API_KEY as string) || '';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
    });

    // Add API key to headers if configured
    if (apiKey) {
      this.client.defaults.headers.common['x-api-key'] = apiKey;
    }

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error('Unauthorized: Invalid API key or session expired');
        }
        return Promise.reject(error);
      }
    );
  }

  // Video Generation endpoints
  async generateVideo(request: GenerateVideoRequest): Promise<VideoJob> {
    const { data } = await this.client.post('/videos/generate', request);
    return this.normalizeVideoJob(data);
  }

  async generateFromContentImages(
    request: GenerateFromImagesRequest
  ): Promise<VideoJob> {
    const { data } = await this.client.post(
      '/videos/generate-from-content-images',
      request
    );
    return this.normalizeVideoJob(data);
  }

  async generateMusicVideo(request: GenerateMusicVideoRequest): Promise<VideoJob> {
    const formData = new FormData();
    formData.append('topic', request.topic);
    if (request.lyrics) formData.append('lyrics', request.lyrics);
    if (request.musicFile) formData.append('musicFile', request.musicFile);
    if (request.musicPath) formData.append('musicPath', request.musicPath);
    if (request.musicUrl) formData.append('musicUrl', request.musicUrl);
    if (request.additionalContext) formData.append('additionalContext', request.additionalContext);
    if (request.style) formData.append('style', request.style);
    if (request.scriptProvider) formData.append('scriptProvider', request.scriptProvider);
    if (request.imageProvider) formData.append('imageProvider', request.imageProvider);
    if (request.imageModel) formData.append('imageModel', request.imageModel);
    if (request.youtubeResolution) formData.append('youtubeResolution', request.youtubeResolution);
    if (request.reelsResolution) formData.append('reelsResolution', request.reelsResolution);
    if (typeof request.fps === 'number') formData.append('fps', String(request.fps));
    if (request.callbackUrl) formData.append('callbackUrl', request.callbackUrl);

    const { data } = await this.client.post('/videos/generate-music-story', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return this.normalizeVideoJob(data);
  }

  // Job status endpoint
  async getJobStatus(jobId: string): Promise<VideoJob> {
    const { data } = await this.client.get(`/videos/jobs/${jobId}`);
    return this.normalizeVideoJob(data);
  }

  // Providers endpoint
  async getProviders(): Promise<Provider[]> {
    const { data } = await this.client.get('/videos/providers');
    return this.normalizeProviders(data);
  }

  // TTS Voices endpoint
  async getTTSVoices(): Promise<TTSVoice[]> {
    const { data } = await this.client.get('/videos/tts-voices');
    return data;
  }

  // Cost Summary endpoint
  async getCostSummary(): Promise<CostSummary> {
    const { data } = await this.client.get('/costs/summary');
    return this.normalizeCostSummary(data);
  }

  // MongoDB Details endpoint (debug panel)
  async getMongoDetails(): Promise<MongoDetails> {
    const { data } = await this.client.get('/videos/mongo-details');
    return this.normalizeMongoDetails(data);
  }

  // Health Check endpoint
  async getHealth(): Promise<HealthStatus> {
    const { data } = await this.client.get('/health');
    return this.normalizeHealth(data);
  }
}

export const apiClient = new APIClient();
