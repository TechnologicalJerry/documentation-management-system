import { v4 as uuidv4 } from 'uuid';
import { AuthUser, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, TokenPair } from '@devdocs/shared-types';
import { BadRequestError, compare, ConflictError, ForbiddenError, hash, UnauthorizedError } from '@devdocs/shared-utils';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from './token.service';
import { AuthPublisher } from '../events/auth.publisher';

export class AuthService {
  constructor(
    private readonly repository = new AuthRepository(),
    private readonly tokens = new TokenService(),
    private readonly publisher?: AuthPublisher,
  ) {}

  async register(input: RegisterRequest, meta: { ip?: string; userAgent?: string }): Promise<RegisterResponse> {
    const existing = await this.repository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('User', 'email');
    }

    const passwordHash = await hash(input.password);
    const user = await this.repository.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'USER',
      permissions: ['documents:read', 'documents:write', 'projects:read', 'projects:write'],
    });

    const tokens = await this.issueTokens(user, meta);
    await this.publisher?.publishUserCreated({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return {
      user: this.toAuthUser(user),
      tokens,
      requiresEmailVerification: true,
    };
  }

  async login(input: LoginRequest, meta: { ip?: string; userAgent?: string }): Promise<LoginResponse> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenError('User account is disabled');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.repository.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, meta);

    return {
      user: this.toAuthUser(user),
      tokens,
    };
  }

  async refresh(rawRefreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    const stored = await this.repository.findRefreshToken(tokenHash);

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedError('Refresh token is invalid or expired');
    }
    if (!stored.user.isActive) {
      throw new ForbiddenError('User account is disabled');
    }

    await this.repository.revokeRefreshToken(stored.id);

    return this.issueTokens(stored.user, meta, stored.tokenFamily);
  }

  async logout(userId: string, refreshToken?: string, logoutAllDevices?: boolean): Promise<void> {
    if (logoutAllDevices) {
      await this.repository.revokeUserTokens(userId);

      return;
    }
    if (!refreshToken) {return;}

    const stored = await this.repository.findRefreshToken(this.tokens.hashRefreshToken(refreshToken));
    if (stored && stored.userId === userId && !stored.revokedAt) {
      await this.repository.revokeRefreshToken(stored.id);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new BadRequestError('User not found');
    }
    const passwordMatches = await compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Current password is invalid');
    }
    await this.repository.updatePassword(userId, await hash(newPassword));
    await this.repository.revokeUserTokens(userId);
  }

  private async issueTokens(
    user: { id: string; email: string; role: string; permissions: string[] },
    meta: { ip?: string; userAgent?: string },
    tokenFamily?: string,
  ): Promise<TokenPair> {
    const sessionId = uuidv4();
    const refresh = this.tokens.issueRefreshToken(tokenFamily);
    await this.repository.createRefreshToken({
      userId: user.id,
      tokenHash: refresh.hash,
      tokenFamily: refresh.family,
      expiresAt: refresh.expiresAt,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.tokens.createTokenPair(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
      sessionId,
      refresh.raw,
    );
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    permissions: string[];
    isActive: boolean;
    lastLoginAt: Date | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
      isActive: user.isActive,
      ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt } : {}),
    };
  }
}
