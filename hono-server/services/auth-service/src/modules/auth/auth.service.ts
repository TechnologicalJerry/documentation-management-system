import crypto from 'node:crypto';

import { env } from '@hono-server/shared/src/config/env';
import { logger } from '@hono-server/shared/src/config/logger';
import { HttpError } from '@hono-server/shared/src/lib/http-error';
import { signAccessToken } from '@hono-server/shared/src/lib/jwt';
import { hashPassword, verifyPassword } from '@hono-server/shared/src/lib/password';
import { prisma } from '@hono-server/db-postgres';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput
} from './auth.schemas';

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function register(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  if (existingUser) {
    throw new HttpError(409, 'Email address is already in use');
  }

  const hashedPassword = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      password: hashedPassword
      // role defaults to "user" in prisma schema
    }
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const passwordMatches = await verifyPassword(input.password, user.password);

  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken
  };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  if (!user) {
    return {
      message: 'If the account exists, a password reset link has been sent.'
    };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(resetToken);
  const expiresAt = new Date(Date.now() + env.RESET_PASSWORD_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null }
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  logger.info('Password reset requested', {
    userId: user.id,
    email: user.email,
    expiresAt: expiresAt.toISOString()
  });

  if (env.NODE_ENV !== 'production') {
    return {
      message: 'If the account exists, a password reset link has been sent.',
      resetToken
    };
  }

  return {
    message: 'If the account exists, a password reset link has been sent.'
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = hashResetToken(input.token);
  const tokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!tokenRecord) {
    throw new HttpError(400, 'Invalid or expired reset token');
  }

  const hashedPassword = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: tokenRecord.userId },
    data: { password: hashedPassword }
  });

  await prisma.passwordResetToken.update({
    where: { id: tokenRecord.id },
    data: { usedAt: new Date() }
  });

  await prisma.passwordResetToken.deleteMany({
    where: { userId: tokenRecord.userId, usedAt: null }
  });

  return {
    message: 'Password has been reset successfully.'
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return user;
}
