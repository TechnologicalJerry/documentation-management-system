import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { logger } from '../lib/logger';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      error: 'Missing or malformed Authorization header',
      code: 'UNAUTHORIZED',
    });

    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug('JWT verification failed', { error: err.message });

    const isExpired = err.name === 'TokenExpiredError';

    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      error: isExpired ? 'Token has expired' : 'Invalid token',
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
}
