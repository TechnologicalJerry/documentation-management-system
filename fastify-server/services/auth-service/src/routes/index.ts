import { FastifyInstance } from 'fastify';
import { authRouter } from './auth.routes';

export async function apiRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    return { service: 'auth-service', status: 'healthy', timestamp: new Date().toISOString() };
  });

  fastify.register(authRouter, { prefix: '/auth' });
}
