import { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { logger } from '../lib/logger';
import { AuthenticatedUser, JwtPayload } from '../types/project.types';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Missing or invalid Authorization header',
        code: 'UNAUTHORIZED',
      });

      return;
    }

    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(config.jwt.secret);

    const { payload } = await jwtVerify(token, secret, {
      issuer: config.jwt.issuer,
    });

    const jwtPayload = payload as unknown as JwtPayload;

    if (typeof jwtPayload.sub !== 'string' || typeof jwtPayload.email !== 'string') {
      res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token payload',
        code: 'UNAUTHORIZED',
      });

      return;
    }

    const user: AuthenticatedUser = {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      roles: jwtPayload.roles,
    };

    req.user = user;
    next();
  } catch (error) {
    logger.debug('JWT verification failed', { error });
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
  }
}

/**
 * Optional authentication — sets req.user if a valid token is present,
 * but does not block unauthenticated requests.
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();

    return;
  }

  try {
    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(config.jwt.secret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: config.jwt.issuer,
    });

    const jwtPayload = payload as unknown as JwtPayload;
    if (typeof jwtPayload.sub === 'string' && typeof jwtPayload.email === 'string') {
      req.user = {
        userId: jwtPayload.sub,
        email: jwtPayload.email,
        roles: jwtPayload.roles,
      };
    }
  } catch {
    // Token present but invalid — proceed as unauthenticated
  }

  next();
}
