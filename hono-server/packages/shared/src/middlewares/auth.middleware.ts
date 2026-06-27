import { createMiddleware } from 'hono/factory';

import type { AuthUser } from '../types/hono';
import { HttpError } from '../lib/http-error';
import { verifyAccessToken } from '../lib/jwt';

export const authMiddleware = createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
  const authHeader = c.req.header('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authorization token is missing or malformed');
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    throw new HttpError(401, 'Authorization token is missing');
  }

  try {
    const payload = verifyAccessToken(token);
    c.set('user', payload);
  } catch {
    throw new HttpError(401, 'Invalid or expired authorization token');
  }

  await next();
});
