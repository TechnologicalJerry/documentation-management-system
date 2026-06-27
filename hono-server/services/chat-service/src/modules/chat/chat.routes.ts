import { Hono } from 'hono';
import { authMiddleware } from '@hono-server/shared/src/middlewares/auth.middleware';
import { redis } from '@hono-server/redis';

export const chatRoutes = new Hono();

chatRoutes.use('*', authMiddleware);

chatRoutes.get('/channels', (c) => {
  return c.json({ channels: [] });
});

chatRoutes.post('/channels', async (c) => {
  const channel = { id: Date.now().toString(), name: 'New Channel' };
  
  // Publish event to realtime service
  await redis.publish('chat:events', JSON.stringify({
    type: 'CHANNEL_CREATED',
    payload: channel
  }));

  return c.json({ message: 'Channel created', channel }, 201);
});
