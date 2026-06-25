export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
}

export interface TokenTTLSeconds {
  access: number;
  refresh: number;
  emailVerification: number;
  passwordReset: number;
  inviteToken: number;
}

/**
 * Parse duration strings like "15m", "7d", "1h" to seconds
 */
export function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };

  return value * (multipliers[unit] ?? 1);
}

export function getJwtConfig(): JwtConfig {
  const accessSecret = process.env['JWT_SECRET'];
  const refreshSecret = process.env['JWT_REFRESH_SECRET'];

  if (!accessSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn: process.env['JWT_ACCESS_EXPIRY'] || '15m',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRY'] || '7d',
    issuer: process.env['JWT_ISSUER'] || 'devdocs-studio',
    audience: process.env['JWT_AUDIENCE'] || 'devdocs-client',
    algorithm: (process.env['JWT_ALGORITHM'] as JwtConfig['algorithm']) || 'HS256',
  };
}

export function getTokenTTLSeconds(): TokenTTLSeconds {
  const config = getJwtConfig();

  return {
    access: parseDurationToSeconds(config.accessExpiresIn),
    refresh: parseDurationToSeconds(config.refreshExpiresIn),
    emailVerification: parseInt(
      process.env['EMAIL_VERIFICATION_TOKEN_TTL_SECONDS'] || '86400',
      10,
    ), // 24h
    passwordReset: parseInt(process.env['PASSWORD_RESET_TOKEN_TTL_SECONDS'] || '3600', 10), // 1h
    inviteToken: parseInt(process.env['INVITE_TOKEN_TTL_SECONDS'] || '604800', 10), // 7d
  };
}
