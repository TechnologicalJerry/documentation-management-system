import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@devdocs/shared-types';
import { ForbiddenError, UnauthorizedError } from '@devdocs/shared-utils';

// Role hierarchy: higher index = more privileges
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.GUEST,
  UserRole.VIEWER,
  UserRole.EDITOR,
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

function getRoleLevel(role: string): number {
  const index = ROLE_HIERARCHY.indexOf(role as UserRole);
  return index === -1 ? -1 : index;
}

/**
 * Require the authenticated user to have at least the specified role level.
 * Users with higher roles are also permitted.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRoleLevel = getRoleLevel(req.user.role);

    // Allow if user role is in allowedRoles OR if user has a higher role than any allowed role
    const isAllowed = allowedRoles.some((role) => {
      const requiredLevel = getRoleLevel(role);
      return userRoleLevel >= requiredLevel;
    });

    if (!isAllowed) {
      return next(
        new ForbiddenError(
          `Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        ),
      );
    }

    next();
  };
}

/**
 * Require the authenticated user to have an exact role match.
 * Does NOT use the role hierarchy.
 */
export function requireExactRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role as UserRole)) {
      return next(
        new ForbiddenError(
          `Required exact role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
        ),
      );
    }

    next();
  };
}

/**
 * Require the authenticated user to have a specific permission string.
 * Permissions are in the format "resource:action" e.g. "documents:write"
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // SUPER_ADMIN bypasses all permission checks
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    const userPermissions = req.user.permissions || [];

    const hasAllPermissions = requiredPermissions.every((perm) => {
      const [resource] = perm.split(':');
      return (
        userPermissions.includes(perm) ||
        userPermissions.includes(`${resource}:*`) ||
        userPermissions.includes('*:*')
      );
    });

    if (!hasAllPermissions) {
      return next(
        new ForbiddenError(
          `Missing required permission(s): ${requiredPermissions.join(', ')}`,
        ),
      );
    }

    next();
  };
}

/**
 * Require at least one of the given permissions (OR logic)
 */
export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    const userPermissions = req.user.permissions || [];

    const hasAny = permissions.some((perm) => {
      const [resource] = perm.split(':');
      return (
        userPermissions.includes(perm) ||
        userPermissions.includes(`${resource}:*`) ||
        userPermissions.includes('*:*')
      );
    });

    if (!hasAny) {
      return next(
        new ForbiddenError(`Missing at least one of permissions: ${permissions.join(', ')}`),
      );
    }

    next();
  };
}

/**
 * Verify that the authenticated user is accessing their own resource,
 * or is an admin/super-admin.
 */
export function requireOwnerOrAdmin(userIdParam: string = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const targetUserId = req.params[userIdParam];
    const isOwner = req.user.sub === targetUserId;
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);

    if (!isOwner && !isAdmin) {
      return next(new ForbiddenError('Access denied: you can only access your own resources'));
    }

    next();
  };
}
