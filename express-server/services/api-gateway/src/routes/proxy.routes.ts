import { Application, Request } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { authenticate } from '@devdocs/shared-middleware';
import { UpstreamService, config, upstreamServices } from '../config';
import { logger } from '../lib/logger';

function createServiceProxy(service: UpstreamService) {
  const options: Options = {
    target: service.target,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: config.proxy.timeoutMs,
    timeout: config.proxy.timeoutMs,
    pathRewrite: (path) => path.replace(service.prefix, '/api/v1'),
    on: {
      proxyReq: (proxyReq, req) => {
        const request = req as Request;
        if (request.requestId) {
          proxyReq.setHeader('x-request-id', request.requestId);
        }
        if (request.user) {
          proxyReq.setHeader('x-user-id', request.user.sub);
          proxyReq.setHeader('x-user-email', request.user.email);
          proxyReq.setHeader('x-user-role', request.user.role);
          proxyReq.setHeader('x-user-permissions', request.user.permissions.join(','));
        }
      },
      error: (err, req, res) => {
        const response = res as import('http').ServerResponse;
        logger.error('Proxy error', {
          service: service.name,
          requestId: (req as Request).requestId,
          message: err.message,
        });
        if (!response.headersSent) {
          response.writeHead(502, { 'Content-Type': 'application/json' });
        }
        response.end(
          JSON.stringify({
            success: false,
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: `${service.name} is unavailable`,
            },
          }),
        );
      },
    },
  };

  return createProxyMiddleware(options);
}

export function registerProxyRoutes(app: Application): void {
  for (const service of upstreamServices) {
    const middlewares = service.protected ? [authenticate, createServiceProxy(service)] : [createServiceProxy(service)];
    app.use(service.prefix, ...middlewares);
  }
}
