import type { Context } from 'hono';

import { createUserSchema, objectIdSchema, paginationSchema, updateUserSchema } from './user.schemas';
import { createUserByAdmin, getUserById, getUsers, patchUser, removeUser } from './user.service';

export async function createUserController(c: Context) {
  const payload = createUserSchema.parse(await c.req.json());
  const actor = c.get('user');
  const user = await createUserByAdmin(payload, actor);

  return c.json({ data: user }, 201);
}

export async function listUsersController(c: Context) {
  const query = paginationSchema.parse(c.req.query());
  const result = await getUsers(query.page, query.limit);

  return c.json(result, 200);
}

export async function getUserByIdController(c: Context) {
  const userId = objectIdSchema.parse(c.req.param('id'));
  const actor = c.get('user');

  if (actor.sub !== userId && actor.role === 'user') {
    return c.json({ error: { message: 'Insufficient permissions to view this user' } }, 403);
  }

  const user = await getUserById(userId);

  return c.json({ data: user }, 200);
}

export async function updateUserController(c: Context) {
  const userId = objectIdSchema.parse(c.req.param('id'));
  const payload = updateUserSchema.parse(await c.req.json());
  const actor = c.get('user');

  const updated = await patchUser(userId, actor, payload);
  return c.json({ data: updated }, 200);
}

export async function deleteUserController(c: Context) {
  const userId = objectIdSchema.parse(c.req.param('id'));
  const actor = c.get('user');

  await removeUser(userId, actor);
  return c.body(null, 204);
}
