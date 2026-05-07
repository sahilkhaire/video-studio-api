export class ContentGenerationException extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ContentGenerationException';
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class ProviderNotConfiguredException extends ContentGenerationException {
  constructor(provider: string) {
    super(
      `Provider "${provider}" is not configured. Please set the required API key in your environment variables.`,
      provider,
    );
    this.name = 'ProviderNotConfiguredException';
  }
}

export class ScriptGenerationException extends ContentGenerationException {
  constructor(provider: string, cause?: Error) {
    super(`Failed to generate script using provider "${provider}"`, provider, cause);
    this.name = 'ScriptGenerationException';
  }
}

export class ImageGenerationException extends ContentGenerationException {
  constructor(provider: string, cause?: Error) {
    super(`Failed to generate image using provider "${provider}"`, provider, cause);
    this.name = 'ImageGenerationException';
  }
}

export class AudioGenerationException extends ContentGenerationException {
  constructor(provider: string, cause?: Error) {
    super(`Failed to generate audio using provider "${provider}"`, provider, cause);
    this.name = 'AudioGenerationException';
  }
}
