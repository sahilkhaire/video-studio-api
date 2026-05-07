import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  name: process.env.APP_NAME || 'video-studio-api',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  enablePlaygroundUi: process.env.ENABLE_PLAYGROUND_UI === 'true',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
}));
