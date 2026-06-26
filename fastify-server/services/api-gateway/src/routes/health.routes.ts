import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { upstreamServices } from '../config';

export async function healthRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks = await Promise.all(
      upstreamServices.map(async (service) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const response = await fetch(`${service.target}/health`, { signal: controller.signal });
          clearTimeout(timeoutId);

          return {
            service: service.name,
            status: response.status >= 200 && response.status < 300 ? 'healthy' : 'unhealthy',
            target: service.target,
          };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          return {
            service: service.name,
            status: 'unhealthy',
            target: service.target,
            error: err.message,
          };
        }
      }),
    );

    const allHealthy = checks.every((check) => check.status === 'healthy');
    reply.status(allHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).send({
      service: 'api-gateway',
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
