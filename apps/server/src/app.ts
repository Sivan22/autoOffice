import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { SettingsRepo } from './db/settings';
import { ConversationsRepo } from './db/conversations';
import { MessagesRepo } from './db/messages';

export type AppConfig = {
  version: string;
  db: Database;
  authToken: string;
};

export function createApp(config: AppConfig) {
  const app = new Hono();
  const settings = new SettingsRepo(config.db);
  const conversations = new ConversationsRepo(config.db);
  const messages = new MessagesRepo(config.db);

  app.route('/', healthRouter(config.version));
  app.use('/api/*', bearerAuth(config.authToken));
  app.route('/api/settings', settingsRouter(settings));
  app.route('/api/conversations', conversationsRouter(conversations, messages));
  return app;
}
