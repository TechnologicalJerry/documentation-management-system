import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Create a separate client for pub/sub subscribers to avoid blocking the main connection
export const createRedisClient = () => {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
};
