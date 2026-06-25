import { FastifyRequest } from 'fastify';

const defaultKeyGenerator = (request: FastifyRequest): string => {
  if (request.user?.sub) return `user:${request.user.sub}`;
  return `ip:${request.ip}`;
};

/**
 * Strict limiter config for authentication endpoints
 */
export const authRateLimiter = {
  max: 10,
  timeWindow: 15 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};

/**
 * Standard API limiter config
 */
export const apiRateLimiter = {
  max: 100,
  timeWindow: 15 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};

/**
 * Lenient limiter config for read operations
 */
export const readRateLimiter = {
  max: 300,
  timeWindow: 15 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};

/**
 * Strict limiter config for write operations
 */
export const writeRateLimiter = {
  max: 50,
  timeWindow: 15 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};

/**
 * AI generation limiter config
 */
export const aiRateLimiter = {
  max: 20,
  timeWindow: 60 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};

/**
 * Export limiter config
 */
export const exportRateLimiter = {
  max: 10,
  timeWindow: 60 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};

/**
 * File upload limiter config
 */
export const uploadRateLimiter = {
  max: 30,
  timeWindow: 60 * 60 * 1000,
  keyGenerator: defaultKeyGenerator,
};
