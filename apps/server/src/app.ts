import { Hono } from 'hono';
import { healthRouter } from './routes/health';

export type AppConfig = {
  version: string;
};

export function createApp(config: AppConfig) {
  const app = new Hono();
  app.route('/', healthRouter(config.version));
  return app;
}
