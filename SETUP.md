# Setup Guide

## System Requirements

- **Node.js**: v20.x LTS (v23+ has canvas compatibility issues)
- **macOS**: Install dependencies via Homebrew
- **Linux**: Install build tools and libraries
- **Windows**: Use WSL2 or install build tools

## macOS Setup

### 1. Install Homebrew Dependencies

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman python
```

### 2. Use Node.js v20 (Recommended)

```bash
# Using nvm
nvm install 20
nvm use 20

# Or using n
n 20
```

### 3. Install Project Dependencies

```bash
npm install
```

### 4. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
OPENAI_API_KEY=sk-your-key-here
```

### 5. Start Infrastructure

```bash
docker-compose up -d redis postgres
```

### 6. Run Development Server

```bash
npm run start:dev
```

## Linux Setup

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### CentOS/RHEL

```bash
sudo yum install -y gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel
```

Then follow steps 2-6 from macOS setup.

## Windows Setup

### Option 1: WSL2 (Recommended)

1. Install WSL2 with Ubuntu
2. Follow Linux setup instructions

### Option 2: Native Windows

1. Install Windows Build Tools:
   ```powershell
   npm install --global windows-build-tools
   ```

2. Install GTK2 dependencies (required for canvas)
   - Download from: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
   - Install to default location

3. Follow steps 2-6 from macOS setup

## Docker Setup (Easiest - No Dependencies)

```bash
# Start all services
docker-compose up

# App will be at http://localhost:3000
# Bull Board at http://localhost:3001
```

## Troubleshooting

### Canvas Installation Fails

**Node v23+ Issue:**
```bash
# Downgrade to Node v20 LTS
nvm install 20
nvm use 20
rm -rf node_modules package-lock.json
npm install
```

**Missing System Dependencies:**
```bash
# macOS
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman

# Ubuntu/Debian
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev

# Check if libraries are found
pkg-config --list-all | grep cairo
```

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Redis Connection Failed

```bash
# Check if Redis is running
docker ps | grep redis

# Or start Redis manually
docker-compose up -d redis

# Test connection
redis-cli ping
```

### FFmpeg Not Found

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Or use Docker** - FFmpeg is included in the container

## Verification

### 1. Check Installation

```bash
# Should compile without errors
npm run build

# Should pass
npm run lint

# Should pass
npm run test
```

### 2. Test API

```bash
# Start server
npm run start:dev

# In another terminal
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":0,"environment":"development"}
```

### 3. Access Swagger Docs

Open browser: http://localhost:3000/api/docs

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) (coming soon) for:
- Kubernetes deployment
- AWS/GCP/Azure setup
- Environment configuration
- Scaling guidelines

## Next Steps

Once setup is complete:

1. Review `.ai-rules.md` for coding standards
2. Check `README.md` for project overview
3. Start implementing features (see `/memories/session/plan.md`)
4. Run tests frequently: `npm run test:watch`

## Getting Help

- Check existing issues in the repository
- Review `.ai-rules.md` for coding patterns
- Consult NestJS documentation: https://docs.nestjs.com
