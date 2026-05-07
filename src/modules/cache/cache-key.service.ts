import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class CacheKeyService {
  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  forScript(request: unknown): string {
    return `script:${this.hash(JSON.stringify(request))}`;
  }

  forImage(request: unknown): string {
    return `image:${this.hash(JSON.stringify(request))}`;
  }

  forAudio(request: unknown): string {
    return `audio:${this.hash(JSON.stringify(request))}`;
  }
}
