import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '@devdocs/shared-types';
import { UnauthorizedError } from '@devdocs/shared-utils';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
    token?: string;
  }
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'change-me-in-production';

/**
 * Extract and verify access token from Authorization header.
 * Attaches the decoded payload to request.user.
 * Does NOT enforce authentication — call requireAuth after this.
 */
export async function verifyAccessToken(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];

  if (!authHeader) {
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Invalid authorization header format. Use Bearer <token>');
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new UnauthorizedError('Token is missing');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    request.user = decoded;
    request.token = token;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
}

/**
 * Enforce that a valid access token was provided.
 * Must be used after verifyAccessToken.
 */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required');
  }
}

/**
 * Combined hook: verify + require auth in one step.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await verifyAccessToken(request, reply);
  await requireAuth(request, reply);
}

/**
 * Optional auth — attaches user if token is present, but does not reject if missing.
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await verifyAccessToken(request, reply);
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
