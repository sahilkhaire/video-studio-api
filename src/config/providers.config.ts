import { registerAs } from '@nestjs/config';

export enum ScriptProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  OLLAMA = 'ollama',
  TOGETHER_AI = 'together-ai',
}

export enum ImageProvider {
  DALLE = 'dalle',
  STABLE_DIFFUSION = 'stable-diffusion',
  LEONARDO = 'leonardo',
  TOGETHER_AI = 'together-ai',
}

export enum TTSProvider {
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  GOOGLE_TTS = 'google-tts',
  COQUI = 'coqui',
}

export default registerAs('providers', () => ({
  // Script Generation Provider
  script: {
    provider: (process.env.SCRIPT_PROVIDER as ScriptProvider) || ScriptProvider.OPENAI,
    model: process.env.SCRIPT_MODEL || 'gpt-4o',
  },

  // Image Generation Provider
  image: {
    provider: (process.env.IMAGE_PROVIDER as ImageProvider) || ImageProvider.DALLE,
    model: process.env.IMAGE_MODEL || 'dall-e-3',
    size: process.env.IMAGE_SIZE || '1024x1024',
  },

  // TTS Provider
  tts: {
    provider: (process.env.TTS_PROVIDER as TTSProvider) || TTSProvider.OPENAI,
    model: process.env.TTS_MODEL || 'tts-1',
    voice: process.env.TTS_VOICE || 'alloy',
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    orgId: process.env.OPENAI_ORG_ID || '',
  },

  // Anthropic Claude Configuration
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
  },

  // ElevenLabs Configuration
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
  },

  // Google Cloud Configuration
  google: {
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  },

  // Replicate Configuration (for Stable Diffusion)
  replicate: {
    apiKey: process.env.REPLICATE_API_KEY || '',
  },

  // TogetherAI Configuration
  together: {
    apiKey: process.env.TOGETHER_API_KEY || '',
  },

  // Estimated cost per API call in USD (configurable via env vars)
  costs: {
    script: {
      openai: parseFloat(process.env.COST_SCRIPT_OPENAI ?? '0.05'),
      claude: parseFloat(process.env.COST_SCRIPT_CLAUDE ?? '0.02'),
      ollama: parseFloat(process.env.COST_SCRIPT_OLLAMA ?? '0.00'),
      'together-ai': parseFloat(process.env.COST_SCRIPT_TOGETHER ?? '0.002'),
    },
    image: {
      dalle: parseFloat(process.env.COST_IMAGE_DALLE ?? '0.04'),
      'stable-diffusion': parseFloat(process.env.COST_IMAGE_SD ?? '0.002'),
      leonardo: parseFloat(process.env.COST_IMAGE_LEONARDO ?? '0.01'),
      'together-ai': parseFloat(process.env.COST_IMAGE_TOGETHER ?? '0.003'),
    },
    tts: {
      openai: parseFloat(process.env.COST_TTS_OPENAI ?? '0.015'),
      elevenlabs: parseFloat(process.env.COST_TTS_ELEVENLABS ?? '0.03'),
      'google-tts': parseFloat(process.env.COST_TTS_GOOGLE ?? '0.004'),
      coqui: parseFloat(process.env.COST_TTS_COQUI ?? '0.00'),
    },
  },
}));
