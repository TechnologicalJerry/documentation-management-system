import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis, createRedisClient } from '@hono-server/redis';
import { logger } from '@hono-server/shared/src/config/logger';
import http from 'node:http';

export function createRealtimeServer(httpServer: http.Server) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Configure as needed
      methods: ['GET', 'POST']
    }
  });

  const pubClient = createRedisClient();
  const subClient = createRedisClient();

  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    logger.info(`Client connected to realtime service: ${socket.id}`);

    socket.on('join_channel', (channelId: string) => {
      socket.join(channelId);
      logger.info(`Socket ${socket.id} joined channel ${channelId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
