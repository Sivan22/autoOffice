import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import type { LanguageModel } from 'ai';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { providersRouter } from './routes/providers';
import { mcpRouter } from './routes/mcp';
import { chatRouter } from './routes/chat';
import { bootstrapRouter } from './routes/bootstrap';
import { importLegacyRouter } from './routes/import-legacy';
import { SettingsRepo } from './db/settings';
import { ConversationsRepo } from './db/conversations';
import { MessagesRepo } from './db/messages';
import { ProvidersRepo } from './db/providers';
import { ProviderRegistry } from './providers';
import { McpServersRepo, McpToolPoliciesRepo } from './db/mcp';
import { McpHub, type CreateClientFn } from './mcp/hub';
import { createDefaultClient } from './mcp/default-client';

export type AppConfig = {
  version: string;
  db: Database;
  authToken: string;
  mcpClientFactory?: CreateClientFn;
  modelOverride?: (providerId: string, modelId: string) => LanguageModel;
};

export function createApp(config: AppConfig) {
  const app = new Hono();
  const settings = new SettingsRepo(config.db);
  const conversations = new ConversationsRepo(config.db);
  const messages = new MessagesRepo(config.db);
  const providers = new ProvidersRepo(config.db);
  const registry = new ProviderRegistry(providers);
  const mcpServers = new McpServersRepo(config.db);
  const mcpPolicies = new McpToolPoliciesRepo(config.db);
  const hub = new McpHub(mcpServers, mcpPolicies, {
    createClient: config.mcpClientFactory ?? createDefaultClient,
  });

  app.route('/', healthRouter(config.version));
  app.route(
    '/bootstrap',
    bootstrapRouter({ token: config.authToken, version: config.version }),
  );
  app.use('/api/*', bearerAuth(config.authToken));
  app.route('/api/settings', settingsRouter(settings));
  app.route('/api/conversations', conversationsRouter(conversations, messages));
  app.route('/api/providers', providersRouter(providers, registry));
  app.route('/api/mcp', mcpRouter(hub, mcpServers, mcpPolicies));
  app.route(
    '/api/chat',
    chatRouter({
      conversations,
      messages,
      registry,
      hub,
      modelOverride: config.modelOverride,
    }),
  );
  app.route('/api/import-legacy', importLegacyRouter({ settings, conversations, messages }));

  // Connect existing MCP servers in the background.
  hub.startAll().catch((err) => console.error('mcp startAll failed', err));

  return Object.assign(app, { __hub: hub });
}
