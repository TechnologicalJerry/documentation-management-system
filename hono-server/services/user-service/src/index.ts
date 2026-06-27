import { Hono } from 'hono';
import { userRoutes } from './modules/users/user.routes';

const app = new Hono();

app.route('/users', userRoutes);

export default app;
