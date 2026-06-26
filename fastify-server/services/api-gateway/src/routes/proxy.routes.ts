import httpProxy from '@fastify/http-proxy';
import { authenticate } from '@devdocs/shared-middleware';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { upstreamServices } from '../config';

export async function registerProxyRoutes(fastify: FastifyInstance): Promise<void> {
  for (const service of upstreamServices) {
    const preHandler = service.protected ? [authenticate] : undefined;

    fastify.register(httpProxy as any, {
      upstream: service.target,
      prefix: service.prefix,
      rewritePrefix: '/api/v1',
      preHandler,
      replyOptions: {
        getUpstreamHeaders: (request: any, headers: any) => {
          const req = request as FastifyRequest;
          const upstreamHeaders: Record<string, string> = {
            ...headers,
          };
          if (req.requestId) {
            upstreamHeaders['x-request-id'] = req.requestId;
          }
          if (req.user) {
            upstreamHeaders['x-user-id'] = req.user.sub;
            upstreamHeaders['x-user-email'] = req.user.email;
            upstreamHeaders['x-user-role'] = req.user.role;
            upstreamHeaders['x-user-permissions'] = req.user.permissions.join(',');
          }
          return upstreamHeaders;
        },
        onError: (reply: any, _error: any) => {
          reply.status(502).send({
            success: false,
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: `${service.name} is unavailable`,
            },
          });
        },
      },
    });
  }
}
