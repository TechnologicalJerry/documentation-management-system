import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '@devdocs/shared-types';
import { UnauthorizedError } from '@devdocs/shared-utils';

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      token?: string;
    }
  }
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'change-me-in-production';

/**
 * Extract and verify access token from Authorization header.
 * Attaches the decoded payload to req.user.
 * Does NOT enforce authentication — call requireAuth after this.
 */
export function verifyAccessToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Invalid authorization header format. Use Bearer <token>'));
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next(new UnauthorizedError('Token is missing'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token has expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Invalid token'));
    }
    next(new UnauthorizedError('Token verification failed'));
  }
}

/**
 * Enforce that a valid access token was provided.
 * Must be used after verifyAccessToken.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  next();
}

/**
 * Combined middleware: verify + require auth in one step.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  verifyAccessToken(req, res, (err) => {
    if (err) return next(err);
    requireAuth(req, res, next);
  });
}

/**
 * Optional auth — attaches user if token is present, but does not reject if missing.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  verifyAccessToken(req, res, next);
}

/**
 * Generate an access token for a given payload (utility used in auth-service)
 */
export function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: string = '15m',
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'devdocs-studio',
    audience: 'devdocs-client',
  } as jwt.SignOptions);
}

/**
 * Verify a token and return the decoded payload (throws on failure)
 */
export function decodeAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'devdocs-studio',
    audience: 'devdocs-client',
  }) as JwtPayload;
}
