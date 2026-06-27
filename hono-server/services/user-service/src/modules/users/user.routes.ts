import { Hono } from 'hono';

import { authMiddleware } from '@hono-server/shared/src/middlewares/auth.middleware';
import { requireRoles } from '@hono-server/shared/src/middlewares/role.middleware';
import {
  createUserController,
  deleteUserController,
  getUserByIdController,
  listUsersController,
  updateUserController
} from './user.controller';

export const userRoutes = new Hono();

userRoutes.use('*', authMiddleware);

userRoutes.post('/', requireRoles(['admin', 'manager']), createUserController);
userRoutes.get('/', requireRoles(['admin', 'manager', 'supperwizer', 'lead']), listUsersController);
userRoutes.get('/:id', getUserByIdController);
userRoutes.patch('/:id', updateUserController);
userRoutes.delete('/:id', deleteUserController);
