import { Hono } from 'hono';
import { authRoutes } from './modules/auth/auth.routes';

const app = new Hono();

app.route('/auth', authRoutes);

export default app;
