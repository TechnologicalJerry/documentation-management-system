import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface RateLimiterConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

function defaultKeyGenerator(req: Request): string {
  // Use authenticated user ID if available, else IP
  if (req.user?.sub) return `user:${req.user.sub}`;
  return `ip:${req.ip}`;
}

function buildLimiter(config: RateLimiterConfig): RateLimitRequestHandler {
  const options: Partial<Options> = {
    windowMs: config.windowMs ?? 15 * 60 * 1000,
    max: config.max ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    skipFailedRequests: config.skipFailedRequests ?? false,
    keyGenerator: config.keyGenerator ?? defaultKeyGenerator,
    handler: (_req: Request, res: Response) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: config.message ?? 'Too many requests, please try again later',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message ?? 'Too many requests, please try again later',
        },
        timestamp: new Date().toISOString(),
      });
    },
  };

  return rateLimit(options);
}

/**
 * Strict limiter for authentication endpoints (login, register, forgot password)
 * 10 attempts per 15 minutes per IP
 */
export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again in 15 minutes',
  skipSuccessfulRequests: false,
});

/**
 * Standard API limiter: 100 requests per 15 minutes
 */
export const apiRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later',
});

/**
 * Lenient limiter for read operations: 300 requests per 15 minutes
 */
export const readRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skipSuccessfulRequests: false,
});

/**
 * Strict limiter for write operations: 50 requests per 15 minutes
 */
export const writeRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many write requests, please slow down',
});

/**
 * AI generation limiter: 20 requests per hour
 */
export const aiRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'AI generation rate limit exceeded, please try again in an hour',
});

/**
 * Export limiter: 10 exports per hour
 */
export const exportRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Export rate limit exceeded, please try again in an hour',
});

/**
 * File upload limiter: 30 uploads per hour
 */
export const uploadRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'File upload rate limit exceeded, please try again in an hour',
});

/**
 * Factory to create a custom rate limiter
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimitRequestHandler {
  return buildLimiter(config);
}
