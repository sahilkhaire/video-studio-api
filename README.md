# Video Studio API

Production-grade NestJS backend for AI-powered short and long-form video generation.

## Overview

Video Studio API generates complete videos from a topic by orchestrating:

1. Script generation (scene-by-scene narration + prompts)
2. Image generation per scene
3. TTS generation per scene
4. Frame composition with captions
5. FFmpeg assembly into final MP4
6. Async queue processing + job tracking

The system supports provider switching, Redis-backed caching, MongoDB persistence, and a dedicated optional playground UI.

## Current Highlights

- Async generation pipeline with BullMQ workers
- Multi-provider architecture (script/image/tts)
- Ratio-aware generation (`16:9`, `9:16`, `1:1`)
- Caption rendering with portrait-safe subtitle layout
- Resilient audio assembly with missing-track safeguards
- Redis content cache (script/image/audio)
- MongoDB persistence for job and cost records
- API key guard + throttling
- Optional web playground at `/api/ui`

## Tech Stack

- NestJS 10 + TypeScript (strict)
- BullMQ + Redis
- MongoDB + Mongoose
- FFmpeg (`fluent-ffmpeg` + `ffmpeg-static`)
- Canvas (`node-canvas`) for frame composition

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set required keys (example):

- `OPENAI_API_KEY` (if using OpenAI providers)
- `TOGETHER_API_KEY` (if using Together providers)
- `ELEVENLABS_API_KEY` (if using ElevenLabs TTS)

### 3. Start infrastructure

```bash
docker compose up -d redis mongodb
```

Optional:

```bash
docker compose up -d bull-board
```

### 4. Run app

```bash
npm run start:dev
```

## API Base

- Base URL: `http://localhost:3000/api`
- Swagger docs (non-production): `http://localhost:3000/api/docs`

## Key Endpoints

### Core

- `POST /api/videos/generate` : enqueue video generation job
- `GET /api/videos/jobs/:jobId` : fetch job status/result
- `GET /api/videos/providers` : active providers
- `GET /api/videos/tts-voices` : voices for active TTS provider
- `GET /api/videos/mongo-details` : recent MongoDB records (jobs + costs)

### System

- `GET /api/health` : health check
- `GET /api/costs/summary` : aggregated cost summary
- `DELETE /api/costs/reset` : reset in-memory cost tracker

### Optional Playground UI

- `GET /api/ui`

Controlled by env flag:

```env
ENABLE_PLAYGROUND_UI=true
```

When disabled, `/api/ui` returns 404.

## Aspect Ratio Behavior

- API accepts `aspectRatio` in generation payload: `16:9`, `9:16`, `1:1`
- If omitted and platform is `instagram_reels`, default is `9:16`
- Image generation size is mapped to selected ratio:
  - `16:9` -> landscape size
  - `9:16` -> portrait size
  - `1:1` -> square size

## Testing and Quality

```bash
npm run build
npm run lint
npm run test
npm run test:integration
npm run test:e2e
```

## Project Name

This repository is now branded as **Video Studio API**.

- npm package: `video-studio-api`
- default app name: `video-studio-api`

