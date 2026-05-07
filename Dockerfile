# Development stage
FROM node:20-alpine AS development

# Install FFmpeg and required dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# Production build stage
FROM node:20-alpine AS build

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install only runtime dependencies and FFmpeg
RUN apk add --no-cache \
    ffmpeg \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Create directories for video storage
RUN mkdir -p /app/storage /app/temp && \
    chown -R node:node /app

# Use non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
