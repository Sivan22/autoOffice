import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { providersRouter } from './routes/providers';
import { SettingsRepo } from './db/settings';
import { ConversationsRepo } from './db/conversations';
import { MessagesRepo } from './db/messages';
import { ProvidersRepo } from './db/providers';
import { ProviderRegistry } from './providers';

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
  const providers = new ProvidersRepo(config.db);
  const registry = new ProviderRegistry(providers);

  app.route('/', healthRouter(config.version));
  app.use('/api/*', bearerAuth(config.authToken));
  app.route('/api/settings', settingsRouter(settings));
  app.route('/api/conversations', conversationsRouter(conversations, messages));
  app.route('/api/providers', providersRouter(providers, registry));
  return app;
}
