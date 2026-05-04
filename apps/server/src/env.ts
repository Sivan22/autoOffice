import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PORT = Number(process.env.AUTOOFFICE_PORT ?? 47318);
export const HOST = process.env.AUTOOFFICE_HOST ?? '127.0.0.1';
export const VERSION = process.env.AUTOOFFICE_VERSION ?? '0.0.0-dev';
export const IS_DEV = process.env.NODE_ENV !== 'production';
export const AUTH_TOKEN = process.env.AUTOOFFICE_TOKEN ?? 'dev-token-replace-me';

export function resolveDataDir(): string {
  const override = process.env.AUTOOFFICE_DATA_DIR;
  if (override) {
    mkdirSync(override, { recursive: true });
    return override;
  }
  const isWin = process.platform === 'win32';
  const base = isWin
    ? process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    : join(homedir(), '.local', 'share');
  const dir = join(base, 'AutoOffice');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return join(resolveDataDir(), 'app.db');
}
