// Invoked by the installer once at install time:
//   "{app}\autoOffice-server.exe" --first-run-init
// Idempotent: if config.json already exists, exits 0 with no changes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCert } from '../tls/generate';
import { installCertToCurrentUserRoot } from '../tls/install-store';
import { makeFreshConfig, saveConfig, loadConfig, configPath } from '../lifecycle/config';
import { resolveDataDir, dbPath } from '../env';
import { openDb } from '../db';

export async function firstRunInit(): Promise<void> {
  const dataDir = resolveDataDir();
  const cfgPath = configPath(dataDir);
  if (loadConfig(dataDir)) {
    console.log(`[autoOffice] config already exists at ${cfgPath}, skipping init.`);
    return;
  }

  console.log('[autoOffice] generating bearer token + cert …');
  const cfg = makeFreshConfig({ port: 47318 });
  const bundle = generateCert({ commonName: `AutoOffice (${cfg.installId})`, validityYears: 10 });

  const certDir = join(dataDir, 'config');
  mkdirSync(certDir, { recursive: true });
  writeFileSync(join(certDir, 'cert.pem'), bundle.cert, 'utf8');
  writeFileSync(join(certDir, 'key.pem'), bundle.key, 'utf8');
  cfg.certFingerprint = bundle.fingerprint;

  saveConfig(dataDir, cfg);

  console.log('[autoOffice] installing cert to CurrentUser\\Root …');
  try {
    await installCertToCurrentUserRoot(bundle.cert);
  } catch (err) {
    console.error('[autoOffice] cert install failed; the user may need to install it manually.');
    console.error((err as Error).message);
  }

  console.log('[autoOffice] initializing database …');
  openDb({ url: dbPath() }).close();

  console.log(`[autoOffice] init complete. Data dir: ${dataDir}`);
}
