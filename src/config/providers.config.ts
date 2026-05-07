import { registerAs } from '@nestjs/config';

export enum ScriptProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  OLLAMA = 'ollama',
}

export enum ImageProvider {
  DALLE = 'dalle',
  STABLE_DIFFUSION = 'stable-diffusion',
  LEONARDO = 'leonardo',
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
    model: process.env.SCRIPT_MODEL || 'gpt-4',
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
}));
