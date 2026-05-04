import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type ServerConfig = {
  installId: string;
  token: string;
  port: number;
  certPath: string;
  keyPath: string;
  certFingerprint: string | null;
};

export function configPath(dir: string): string {
  return join(dir, 'config', 'config.json');
}

export function makeFreshConfig(opts: { port: number }): ServerConfig {
  return {
    installId: randomBytes(16).toString('hex'),
    token: randomBytes(32).toString('hex'),
    port: opts.port,
    certPath: 'config/cert.pem',
    keyPath: 'config/key.pem',
    certFingerprint: null,
  };
}

export function saveConfig(dir: string, cfg: ServerConfig): void {
  const target = configPath(dir);
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(target, JSON.stringify(cfg, null, 2), 'utf8');
}

export function loadConfig(dir: string): ServerConfig | null {
  const path = configPath(dir);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function rotateToken(dir: string): ServerConfig {
  const cur = loadConfig(dir);
  if (!cur) throw new Error('no config to rotate');
  const next: ServerConfig = { ...cur, token: randomBytes(32).toString('hex') };
  saveConfig(dir, next);
  return next;
}
