import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from '@devdocs/shared-types';
import { config } from '../config';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../types/file.types';

export const authenticate: RequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers['authorization'];

  if (authHeader === undefined || authHeader === '') {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Authorization header is required',
    });

    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] === undefined || parts[1] === '') {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid authorization format. Expected: Bearer <token>',
    });

    return;
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.warn('JWT verification failed', { error: err.message });

    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

export const optionalAuthenticate: RequestHandler = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers['authorization'];

  if (authHeader === undefined || authHeader === '') {
    next();

    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer' && parts[1] !== undefined && parts[1] !== '') {
    try {
      const payload = jwt.verify(parts[1], config.jwt.secret) as JwtPayload;
      req.user = payload;
    } catch {
      // Silently ignore invalid optional token
    }
  }

  next();
};
