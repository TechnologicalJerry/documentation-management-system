import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../app';

describe('API Gateway Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health - returns gateway health checks', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    // The status might be 503 (degraded) if other microservices aren't running, which is fine!
    expect([200, 503]).toContain(response.statusCode);
    const body = JSON.parse(response.payload);
    expect(body.service).toBe('api-gateway');
    expect(body.status).toBeDefined();
  });

  it('GET /openapi.json - returns OpenAPI doc', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/openapi.json',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.openapi).toBe('3.0.3');
    expect(body.info.title).toBe('DevDocs Studio API');
  });

  it('GET /non-existent-route - returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
