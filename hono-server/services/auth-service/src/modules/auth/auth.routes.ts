import { Hono } from 'hono';

import { authMiddleware } from '@hono-server/shared/src/middlewares/auth.middleware';
import {
	forgotPasswordController,
	loginController,
	meController,
	registerController,
	resetPasswordController
} from './auth.controller';

export const authRoutes = new Hono();

authRoutes.post('/register', registerController);
authRoutes.post('/login', loginController);
authRoutes.post('/forgot-password', forgotPasswordController);
authRoutes.post('/reset-password', resetPasswordController);
authRoutes.get('/me', authMiddleware, meController);
