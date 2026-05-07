# Video Generation POC

Production-grade NestJS application for programmatic video generation using AI-powered content creation.

## 🎯 Overview

This POC demonstrates programmatic video generation for Reels and YouTube content (15s to 10+ minutes) without relying on third-party video generation SaaS tools. Uses AI for content generation (scripts, images, audio) and assembles videos using FFmpeg + node-canvas.

### Key Features

- **Multi-Provider AI Integration**: Switch between OpenAI, Anthropic, Stable Diffusion, ElevenLabs, etc.
- **Production-Grade Architecture**: Clean Architecture, SOLID principles, comprehensive testing
- **Async Job Processing**: BullMQ-based queue system with retry and error handling
- **Flexible Content Input**: Text topics, JSON/YAML specs, or user-uploaded assets
- **Storytelling Support**: Character consistency, scene templates, animations
- **Observable**: Structured logging, Prometheus metrics, health checks
- **Scalable**: Horizontal scaling, containerized, Kubernetes-ready

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Redis (or use Docker)
- PostgreSQL (or use Docker)
- FFmpeg (or use Docker)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd poc-video-building

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your API keys
# Required: OPENAI_API_KEY (or other provider keys)

# Start infrastructure (Redis, PostgreSQL)
docker-compose up -d redis postgres

# Run database migrations (when implemented)
# npm run migration:run

# Start development server
npm run start:dev
```

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up

# App will be available at http://localhost:3000
# API docs: http://localhost:3000/api/docs
# Bull Board: http://localhost:3001
```

## 📖 Documentation

### Project Structure

```
src/
├── modules/          # Feature modules
│   ├── video/       # Video generation orchestration
│   ├── rendering/   # Frame rendering & FFmpeg
│   ├── content/     # AI content generation
│   ├── queue/       # Job queue & workers
│   └── storage/     # Storage abstraction
├── domain/          # Core business logic
│   ├── entities/    # Domain entities
│   ├── interfaces/  # Contracts
│   └── value-objects/
├── common/          # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   └── interceptors/
├── config/          # Configuration
└── monitoring/      # Health checks & metrics
```

### API Endpoints

Once implemented, the API will provide:

- `POST /api/videos` - Create video generation job
- `GET /api/videos/:id` - Get job status
- `GET /api/videos/:id/download` - Download video
- `GET /api/videos` - List all jobs
- `DELETE /api/videos/:id` - Delete video
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

### Environment Configuration

See `.env.example` for all configuration options.

**Key configurations:**

- **Providers**: Switch between AI providers (OpenAI, Claude, Ollama, etc.)
- **Video Settings**: Resolution, FPS, codec, duration limits
- **Storage**: Local filesystem or S3
- **Queue**: Concurrency, retries, timeouts
- **Caching**: TTL for different content types

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Integration tests
npm run test:integration

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## 🔧 Development

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Pre-commit Hooks

Husky is configured to run linting and formatting before commits.

### Coding Standards

All code must follow the guidelines in `.ai-rules.md`:

- TypeScript strict mode
- No `any` types
- Comprehensive error handling
- Structured logging
- Test coverage >80%
- JSDoc documentation

## 🏗️ Architecture

### Multi-Provider Pattern

All external AI services are abstracted behind interfaces:

```typescript
interface IScriptGenerator {
  generate(topic: string): Promise<Script>;
}
```

Implementations: `OpenAIScriptProvider`, `ClaudeScriptProvider`, `OllamaScriptProvider`

Switch providers via environment:
```env
SCRIPT_PROVIDER=openai  # or claude, ollama
```

### Clean Architecture Layers

1. **Domain**: Business entities and interfaces (framework-independent)
2. **Application**: Use cases and orchestration (module services)
3. **Infrastructure**: External integrations (providers, database, storage)
4. **Presentation**: REST API (controllers, DTOs)

### Async Processing

- Jobs queued immediately, processing in background
- BullMQ with Redis for distributed job processing
- Retry with exponential backoff
- Circuit breaker for external APIs
- Dead letter queue for failed jobs

## 🔐 Security

- Input validation with class-validator
- Rate limiting on all endpoints
- Helmet.js security headers
- Secrets via environment variables
- No sensitive data in logs
- HTTPS in production

## 📊 Monitoring

- **Health Checks**: `/health` endpoint (liveness, readiness)
- **Metrics**: Prometheus format at `/metrics`
- **Logging**: Structured JSON logs with Pino
- **Tracing**: Correlation IDs for request tracking

## 🚢 Deployment

### Docker

```bash
# Build production image
docker build -t video-generation:latest .

# Run container
docker run -p 3000:3000 --env-file .env video-generation:latest
```

### Kubernetes

Helm charts and K8s manifests will be provided in the `k8s/` directory.

## 📝 Contributing

1. Read `.ai-rules.md` for coding standards
2. Create feature branch
3. Write tests (TDD approach)
4. Ensure all tests pass
5. Submit pull request

## 📄 License

MIT

## 🙏 Acknowledgments

- NestJS framework
- FFmpeg for video processing
- OpenAI for AI capabilities
- All open-source contributors

---

**Status**: 🚧 Work in Progress - Phase 1 Foundation Complete

See `ROADMAP.md` for implementation progress and upcoming features.
