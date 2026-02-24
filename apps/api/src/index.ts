import { Hono } from 'hono';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
