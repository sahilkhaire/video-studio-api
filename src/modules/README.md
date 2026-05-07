# Modules

This directory contains all feature modules for the video generation application.

## Module Structure

Each module should follow NestJS conventions and include:

- `{module}.module.ts` - Module definition
- `{module}.controller.ts` - HTTP endpoints (if applicable)
- `{module}.service.ts` - Business logic
- `dto/` - Data Transfer Objects
- `interfaces/` - TypeScript interfaces
- `{module}.spec.ts` - Unit tests

## Planned Modules

### Video Module
Main orchestration module for video generation jobs.

### Rendering Module
Frame rendering and FFmpeg video composition.

### Content Module  
AI-powered content generation (scripts, images, audio) with multi-provider support.

### Queue Module
BullMQ job queue management and worker processes.

### Storage Module
Storage abstraction layer (local filesystem, S3).
