import { uninstallCertByFingerprint } from '../tls/install-store';
import { loadConfig } from '../lifecycle/config';
import { resolveDataDir } from '../env';

export async function certUninstall(): Promise<void> {
  const cfg = loadConfig(resolveDataDir());
  if (!cfg?.certFingerprint) {
    console.log('[autoOffice] no fingerprint to remove.');
    return;
  }
  await uninstallCertByFingerprint(cfg.certFingerprint);
  console.log('[autoOffice] cert removed from CurrentUser\\Root');
}
