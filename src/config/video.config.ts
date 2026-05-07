import { registerAs } from '@nestjs/config';

export enum VideoResolution {
  SD = '480p',
  HD = '720p',
  FULL_HD = '1080p',
  UHD_4K = '2160p',
}

export enum VideoCodec {
  H264 = 'h264',
  H265 = 'h265',
  VP9 = 'vp9',
}

export default registerAs('video', () => ({
  resolution: (process.env.DEFAULT_VIDEO_RESOLUTION as VideoResolution) || VideoResolution.FULL_HD,
  fps: parseInt(process.env.DEFAULT_VIDEO_FPS || '30', 10),
  codec: (process.env.DEFAULT_VIDEO_CODEC as VideoCodec) || VideoCodec.H264,
  maxDuration: parseInt(process.env.MAX_VIDEO_DURATION || '600', 10),
  minDuration: parseInt(process.env.MIN_VIDEO_DURATION || '15', 10),

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localPath: process.env.LOCAL_STORAGE_PATH || './storage',
    tempPath: process.env.TEMP_STORAGE_PATH || './temp',
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '2', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '5000', 10),
  },

  cache: {
    ttlScripts: parseInt(process.env.CACHE_TTL_SCRIPTS || '2592000', 10), // 30 days
    ttlImages: parseInt(process.env.CACHE_TTL_IMAGES || '604800', 10), // 7 days
    ttlAudio: parseInt(process.env.CACHE_TTL_AUDIO || '604800', 10), // 7 days
  },
}));
