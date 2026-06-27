import { createMiddleware } from 'hono/factory';

import { HttpError } from '../lib/http-error';
import type { UserRole } from '../types/user.roles';

export function requireRoles(allowedRoles: UserRole[]) {
  return createMiddleware(async (c, next) => {
    const actor = c.get('user');

    if (!allowedRoles.includes(actor.role)) {
      throw new HttpError(403, 'Insufficient permissions for this action');
    }

    await next();
  });
}
