import { FastifyInstance } from 'fastify';
import { authenticate, validate } from '@devdocs/shared-middleware';
import { AuthController } from '../controllers/auth.controller';
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '../validators/auth.validators';

const controller = new AuthController();

export async function authRouter(fastify: FastifyInstance): Promise<void> {
  fastify.post('/register', { preHandler: [validate(registerSchema)] }, controller.register);
  fastify.post('/login', { preHandler: [validate(loginSchema)] }, controller.login);
  fastify.post('/refresh', { preHandler: [validate(refreshSchema)] }, controller.refresh);
  fastify.post('/logout', { preHandler: [authenticate, validate(logoutSchema)] }, controller.logout);
  fastify.get('/me', { preHandler: [authenticate] }, controller.me);
  fastify.post('/change-password', { preHandler: [authenticate, validate(changePasswordSchema)] }, controller.changePassword);
}
