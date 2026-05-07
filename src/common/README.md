# Common

Shared utilities, decorators, filters, guards, interceptors, and pipes used across the application.

## Structure

### decorators/
Custom decorators for controllers and methods
- `@Public()` - Mark routes as public (skip auth)
- `@CurrentUser()` - Extract user from request
- `@Cache()` - Cache method responses

### filters/
Exception filters for error handling
- `AllExceptionsFilter` - Global exception handler
- `HttpExceptionFilter` - HTTP-specific error handler
- `ValidationExceptionFilter` - DTO validation errors

### guards/
Route guards for authorization and authentication
- `JwtAuthGuard` - JWT token validation
- `RolesGuard` - Role-based access control
- `RateLimitGuard` - API rate limiting

### interceptors/
Request/response interceptors
- `LoggingInterceptor` - Log all requests/responses
- `TimeoutInterceptor` - Add timeout to requests
- `TransformInterceptor` - Transform response format
- `CacheInterceptor` - Response caching

### pipes/
Custom validation and transformation pipes
- `ValidationPipe` - Input validation
- `ParseIntPipe` - Parse string to integer
- `TrimPipe` - Trim string values

### utils/
Utility functions and helpers
- `logger.util.ts` - Logging utilities
- `crypto.util.ts` - Encryption/hashing
- `date.util.ts` - Date formatting
- `file.util.ts` - File operations

### constants/
Application-wide constants
- `video.constants.ts` - Video-related constants
- `http.constants.ts` - HTTP status codes and messages
- `queue.constants.ts` - Queue names and priorities

## Guidelines

- Keep utilities pure and testable
- No business logic here
- Reusable across all modules
- Well-documented and tested
