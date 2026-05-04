-- 002_provider_mcp.sql
CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  config TEXT NOT NULL,           -- JSON, non-secret
  encrypted_key BLOB,             -- DPAPI-wrapped, NULL for CLI bridges
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  transport TEXT NOT NULL,        -- 'stdio' | 'sse' | 'streamable-http'
  command TEXT,
  args TEXT,                       -- JSON array
  cwd TEXT,
  env TEXT,                        -- JSON object
  url TEXT,
  headers TEXT,                    -- JSON object
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  default_policy TEXT NOT NULL DEFAULT 'ask' CHECK (default_policy IN ('allow','ask','deny')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_tool_policies (
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  policy TEXT NOT NULL CHECK (policy IN ('allow','ask','deny')),
  PRIMARY KEY (server_id, tool_name)
);
