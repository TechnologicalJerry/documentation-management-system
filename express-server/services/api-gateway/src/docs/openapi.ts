import { upstreamServices } from '../config';

const paths = upstreamServices.reduce<Record<string, unknown>>((acc, service) => {
  acc[`${service.prefix}/{proxyPath}`] = {
    get: {
      tags: [service.name],
      summary: `Proxy GET requests to ${service.name}`,
      parameters: [
        {
          in: 'path',
          name: 'proxyPath',
          required: false,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': { description: 'Successful upstream response' },
        '401': { description: 'Authentication required' },
        '502': { description: 'Upstream service unavailable' },
      },
    },
    post: {
      tags: [service.name],
      summary: `Proxy POST requests to ${service.name}`,
      responses: {
        '200': { description: 'Successful upstream response' },
        '201': { description: 'Created upstream resource' },
        '401': { description: 'Authentication required' },
        '502': { description: 'Upstream service unavailable' },
      },
    },
  };

  return acc;
}, {});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'DevDocs Studio API',
    version: '1.0.0',
    description: 'API Gateway documentation for the DevDocs Studio microservices backend.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['gateway'],
        summary: 'Gateway health check',
        responses: { '200': { description: 'Gateway health status' } },
      },
    },
    ...paths,
  },
};
