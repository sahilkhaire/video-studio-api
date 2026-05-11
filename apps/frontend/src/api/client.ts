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
    return data;
  }

  async generateFromContentImages(
    request: GenerateFromImagesRequest
  ): Promise<VideoJob> {
    const { data } = await this.client.post(
      '/videos/generate-from-content-images',
      request
    );
    return data;
  }

  async generateMusicVideo(request: GenerateMusicVideoRequest): Promise<VideoJob> {
    const formData = new FormData();
    formData.append('musicFile', request.musicFile);
    if (request.prompt) formData.append('prompt', request.prompt);
    if (request.duration) formData.append('duration', String(request.duration));

    const { data } = await this.client.post('/videos/generate-music-story', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  }

  // Job status endpoint
  async getJobStatus(jobId: string): Promise<VideoJob> {
    const { data } = await this.client.get(`/videos/jobs/${jobId}`);
    return data;
  }

  // Providers endpoint
  async getProviders(): Promise<Provider[]> {
    const { data } = await this.client.get('/videos/providers');
    return data;
  }

  // TTS Voices endpoint
  async getTTSVoices(): Promise<TTSVoice[]> {
    const { data } = await this.client.get('/videos/tts-voices');
    return data;
  }

  // Cost Summary endpoint
  async getCostSummary(): Promise<CostSummary> {
    const { data } = await this.client.get('/costs/summary');
    return data;
  }

  // MongoDB Details endpoint (debug panel)
  async getMongoDetails(): Promise<MongoDetails> {
    const { data } = await this.client.get('/videos/mongo-details');
    return data;
  }

  // Health Check endpoint
  async getHealth(): Promise<HealthStatus> {
    const { data } = await this.client.get('/health');
    return data;
  }
}

export const apiClient = new APIClient();
