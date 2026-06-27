import type { Context } from 'hono';

import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from './auth.schemas';
import { forgotPassword, login, register, resetPassword, getMe } from './auth.service';

export async function registerController(c: Context) {
  const payload = registerSchema.parse(await c.req.json());
  const result = await register(payload);

  return c.json({ data: result }, 201);
}

export async function loginController(c: Context) {
  const payload = loginSchema.parse(await c.req.json());
  const result = await login(payload);

  return c.json({ data: result }, 200);
}

export async function forgotPasswordController(c: Context) {
  const payload = forgotPasswordSchema.parse(await c.req.json());
  const result = await forgotPassword(payload);

  return c.json({ data: result }, 200);
}

export async function resetPasswordController(c: Context) {
  const payload = resetPasswordSchema.parse(await c.req.json());
  const result = await resetPassword(payload);

  return c.json({ data: result }, 200);
}

export async function meController(c: Context) {
  const actor = c.get('user');
  const user = await getMe(actor.sub);

  return c.json({ data: user }, 200);
}
