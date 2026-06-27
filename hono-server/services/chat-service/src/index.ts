import { Hono } from 'hono';
import { chatRoutes } from './modules/chat/chat.routes';

const app = new Hono();

app.route('/chat', chatRoutes);

export default app;
