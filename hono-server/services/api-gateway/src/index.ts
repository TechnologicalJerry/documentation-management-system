import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { env } from '@hono-server/shared/src/config/env';
import { handleAppError } from '@hono-server/shared/src/middlewares/error.middleware';

export const app = new Hono();

app.use('*', cors());
app.use('*', secureHeaders());

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  })
);

// Proxy requests to user-service
const userServiceUrl = env.USER_SERVICE_URL || 'http://localhost:3004';
app.all('/api/v1/users/*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/v1/users', '/users');
  return fetch(`${userServiceUrl}${url.pathname}${url.search}`, c.req.raw);
});

// Proxy requests to auth-service
const authServiceUrl = env.AUTH_SERVICE_URL || 'http://localhost:3001';
app.all('/api/v1/auth/*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/v1/auth', '/auth');
  return fetch(`${authServiceUrl}${url.pathname}${url.search}`, c.req.raw);
});

// Proxy requests to chat-service
const chatServiceUrl = env.CHAT_SERVICE_URL || 'http://localhost:3002';
app.all('/api/v1/chat/*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/v1/chat', '/chat');
  return fetch(`${chatServiceUrl}${url.pathname}${url.search}`, c.req.raw);
});

// Proxy to realtime-service (WebSocket upgrade handled differently if native proxy, but let's route HTTP for now)
const realtimeServiceUrl = env.REALTIME_SERVICE_URL || 'http://localhost:3003';
app.all('/api/v1/realtime/*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/v1/realtime', '/');
  return fetch(`${realtimeServiceUrl}${url.pathname}${url.search}`, c.req.raw);
});

app.notFound((c) => c.json({ error: { message: 'Route not found' } }, 404));
app.onError(handleAppError);

export default app;
