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

## Generated Video Showcase

Sample outputs currently present in this repository workspace:

### Sample 1

<video src="artifacts/videos/video-1d686ff8-e7a2-49fd-8a19-7c59df509893.mp4" controls muted playsinline width="720"></video>

Fallback link: [video-1d686ff8-e7a2-49fd-8a19-7c59df509893.mp4](artifacts/videos/video-1d686ff8-e7a2-49fd-8a19-7c59df509893.mp4)

### Sample 2

<video src="artifacts/videos/video-c20fa10a-d5e5-4770-bb42-55de99edc3ea.mp4" controls muted playsinline width="720"></video>

Fallback link: [video-c20fa10a-d5e5-4770-bb42-55de99edc3ea.mp4](artifacts/videos/video-c20fa10a-d5e5-4770-bb42-55de99edc3ea.mp4)


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
- `POST /api/videos/generate-from-content-images` : generate final video directly from provided content + image segments (synchronous)
- `POST /api/videos/generate-music-story` : enqueue visual-only storytelling job from a song (creates YouTube + Reels variants in one job)
- `GET /api/videos/jobs/:jobId` : fetch job status/result
- `GET /api/videos/providers` : active providers
- `GET /api/videos/tts-voices` : voices for active TTS provider
- `GET /api/videos/mongo-details` : recent MongoDB records (jobs + costs)

### Generation Modes

- Queue-based async routes:
  - `POST /api/videos/generate`
  - `POST /api/videos/generate-music-story`
  - Returns `jobId` immediately. Use `GET /api/videos/jobs/:jobId` for progress/result.
- Direct synchronous route:
  - `POST /api/videos/generate-from-content-images`
  - Returns full generation result immediately in the response.

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

Current playground capabilities:

- Standard generation form (`/api/videos/generate`)
- Music visual story form (`/api/videos/generate-music-story`)
- Content + images form (`/api/videos/generate-from-content-images`)
- Callback URL input support for all generation flows
- Provider and voice inspection helpers
- Job status polling and MongoDB details views

## Music Visual Story Route

Dedicated endpoint for your new use case: pure visual storytelling with song-only audio.

- Route: `POST /api/videos/generate-music-story`
- Input modes: multipart upload (`musicFile`) or existing `musicPath` or remote `musicUrl`
- Output: one async job that renders both variants
  - YouTube (`16:9`)
  - Instagram Reels (`9:16`)
- Captions/subtitles: disabled
- Narration/TTS: disabled
- Audio track: original song only
- Provider override support (per request)
  - `scriptProvider` (e.g. `openai`, `together-ai`)
  - `imageProvider` (e.g. `dalle`, `together-ai`)

Example JSON request (path/url mode):

```json
{
  "topic": "A hopeful journey from struggle to success",
  "lyrics": "...optional lyrics guidance...",
  "musicUrl": "https://example.com/song.mp3",
  "style": "cartoon",
  "scriptProvider": "together-ai",
  "imageProvider": "together-ai",
  "youtubeResolution": "1080p",
  "reelsResolution": "1080p",
  "fps": 30
}
```

Result is available via `GET /api/videos/jobs/:jobId` and includes both output variants when completed.

## Content + Images Route

Route for building a final video from user-provided segment data.

- Route: `POST /api/videos/generate-from-content-images`
- Input: `data: [{ content: string, images: string[] }]`
- Audio: generated with free Edge TTS per content segment
- Image timing: evenly distributed across images for each segment
- Captions: optional (`showCaptions`, alias `showCaption`)
- Mode: synchronous (returns final result directly)

Example request:

```json
{
  "data": [
    {
      "content": "Validation beats assumptions. Test demand first.",
      "images": [
        "https://example.com/one.jpg",
        "https://example.com/two.jpg"
      ]
    }
  ],
  "showCaptions": true,
  "voice": "en-US-AriaNeural",
  "resolution": "720p",
  "aspectRatio": "16:9",
  "fps": 30
}
```

## Callback URL Support

All generation routes support optional `callbackUrl`.

- Supported routes:
  - `POST /api/videos/generate`
  - `POST /api/videos/generate-music-story`
  - `POST /api/videos/generate-from-content-images`
- On successful generation, the server sends `POST` to `callbackUrl`.
- Callback delivery failures are logged and do not fail the generation job.

Standard callback payload:

```json
{
  "jobId": "f5b4b0f1-91b6-4a47-8c0c-d6d3d5f77241",
  "status": "completed",
  "videoUrl": "/path/to/generated/video.mp4"
}
```

Music visual story callback payload includes variant URLs:

```json
{
  "jobId": "f5b4b0f1-91b6-4a47-8c0c-d6d3d5f77241",
  "status": "completed",
  "videoUrl": "/path/to/youtube-variant.mp4",
  "videoUrls": [
    "/path/to/youtube-variant.mp4",
    "/path/to/reels-variant.mp4"
  ]
}
```

Note: with local storage, `videoUrl` may be a local/server path. With cloud storage providers, it can be a public or signed URL based on provider behavior.

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

