import { HttpError } from '@hono-server/shared/src/lib/http-error';
import { hashPassword } from '@hono-server/shared/src/lib/password';
import type { AuthUser } from '@hono-server/shared/src/types/hono';
import { prisma } from '@hono-server/db-postgres';
import type { CreateUserInput, UpdateUserInput } from './user.schemas';
import { ROLE_HIERARCHY, type UserRole } from '@hono-server/shared/src/types/user.roles';

export type UserResponse = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
};

function hasRoleAtLeast(currentRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole];
}

function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'admin') return true;
  if (actorRole === 'manager') return targetRole === 'lead' || targetRole === 'user';
  return false;
}

export async function createUserByAdmin(input: CreateUserInput, actor: AuthUser): Promise<UserResponse> {
  if (!hasRoleAtLeast(actor.role as UserRole, 'manager')) {
    throw new HttpError(403, 'Insufficient permissions to create users');
  }

  const requestedRole = (input.role as UserRole) ?? 'user';

  if (!canManageRole(actor.role as UserRole, requestedRole)) {
    throw new HttpError(403, 'You cannot assign this role');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() }
  });

  if (existingUser) {
    throw new HttpError(409, 'Email address is already in use');
  }

  const hashedPassword = await hashPassword(input.password);
  const createdUser = await prisma.user.create({
    data: {
      ...input,
      email: input.email.toLowerCase(),
      password: hashedPassword,
      role: requestedRole
    }
  });

  return {
    id: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role as UserRole,
    createdAt: createdUser.createdAt,
    updatedAt: createdUser.updatedAt
  };
}

export async function getUserById(userId: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function getUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } })
  ]);

  return {
    data: users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function patchUser(
  userId: string,
  actor: AuthUser,
  input: UpdateUserInput
): Promise<UserResponse> {
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!targetUser) {
    throw new HttpError(404, 'User not found');
  }

  const isSelf = actor.sub === userId;
  const isPrivileged = hasRoleAtLeast(actor.role as UserRole, 'manager');

  if (!isSelf && !isPrivileged) {
    throw new HttpError(403, 'You can only update your own account');
  }

  if (!isSelf && isPrivileged && !canManageRole(actor.role as UserRole, targetUser.role as UserRole)) {
    throw new HttpError(403, 'You cannot update this user');
  }

  const payload: Partial<{ name: string; email: string; password: string; role: string }> = {};

  if (input.name) payload.name = input.name;

  if (input.role) {
    if (!isPrivileged) throw new HttpError(403, 'You are not allowed to change roles');
    if (!canManageRole(actor.role as UserRole, input.role as UserRole)) throw new HttpError(403, 'You cannot assign this role');
    payload.role = input.role;
  }

  if (input.email) {
    const normalizedEmail = input.email.toLowerCase();
    const userWithEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (userWithEmail && userWithEmail.id !== userId) {
      throw new HttpError(409, 'Email address is already in use');
    }
    payload.email = normalizedEmail;
  }

  if (input.password) {
    payload.password = await hashPassword(input.password);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: payload
  });

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role as UserRole,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt
  };
}

export async function removeUser(userId: string, actor: AuthUser): Promise<void> {
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!targetUser) throw new HttpError(404, 'User not found');

  const isSelf = actor.sub === userId;

  if (!isSelf) {
    if (!hasRoleAtLeast(actor.role as UserRole, 'manager')) {
      throw new HttpError(403, 'You can only delete your own account');
    }
    if (!canManageRole(actor.role as UserRole, targetUser.role as UserRole)) {
      throw new HttpError(403, 'You cannot delete this user');
    }
  }

  await prisma.user.delete({ where: { id: userId } });
}
