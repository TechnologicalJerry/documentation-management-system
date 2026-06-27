import jwt from 'jsonwebtoken';
import { TokenPair, JwtPayload } from '@devdocs/shared-types';
import { generateToken, sha256 } from '@devdocs/shared-utils';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export interface TokenUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface RefreshTokenIssue {
  raw: string;
  hash: string;
  family: string;
  expiresAt: Date;
}

export class TokenService {
  signAccessToken(user: TokenUser, sessionId: string): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry,
      issuer: 'devdocs-studio',
      audience: 'devdocs-client',
    } as jwt.SignOptions);
  }

  issueRefreshToken(family?: string): RefreshTokenIssue {
    const raw = generateToken(48);
    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000);

    return {
      raw,
      hash: sha256(raw),
      family: family ?? uuidv4(),
      expiresAt,
    };
  }

  hashRefreshToken(raw: string): string {
    return sha256(raw);
  }

  createTokenPair(user: TokenUser, sessionId: string, refreshToken: string): TokenPair {
    return {
      accessToken: this.signAccessToken(user, sessionId),
      refreshToken,
      expiresIn: 15 * 60,
      tokenType: 'Bearer',
    };
  }
}
