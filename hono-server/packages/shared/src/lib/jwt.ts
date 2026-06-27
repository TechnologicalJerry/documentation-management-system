import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import type { UserRole } from '../types/user.roles';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export function signAccessToken(payload: JwtPayload): string {
  const expiresIn = env.JWT_EXPIRES_IN as SignOptions['expiresIn'];

  const options: SignOptions = {
    expiresIn
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
