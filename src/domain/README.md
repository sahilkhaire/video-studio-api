# Domain Layer

This directory contains core business logic following Clean Architecture principles.

## Structure

### entities/
Domain entities representing core business objects (VideoJob, Scene, Frame, etc.)

### interfaces/
Core business interfaces and contracts (IScriptGenerator, IImageGenerator, ITTSProvider, IStorageProvider)

### value-objects/
Immutable value objects (Duration, Resolution, VideoFormat, etc.)

## Principles

- **Framework Independent**: No NestJS or external library dependencies
- **Business Logic**: Pure TypeScript classes and interfaces
- **Testable**: Easy to unit test without external dependencies
- **Stable**: Changes here should be rare and well-considered

## Example

```typescript
// entities/video-job.entity.ts
export class VideoJob {
  constructor(
    public readonly id: string,
    public status: JobStatus,
    public readonly topic: string,
    public progress: number,
  ) {}

  markAsCompleted(): void {
    this.status = JobStatus.COMPLETED;
    this.progress = 100;
  }
}

// interfaces/script-generator.interface.ts
export interface IScriptGenerator {
  generate(topic: string, options?: ScriptGenerationOptions): Promise<Script>;
  validate(script: Script): Promise<boolean>;
  estimateCost(topic: string): number;
}
```
