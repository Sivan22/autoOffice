import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function installCertToCurrentUserRoot(certPem: string): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Cert install is only supported on Windows in v1.');
  }
  if (!/-----BEGIN CERTIFICATE-----/.test(certPem)) {
    throw new Error('Expected PEM-encoded certificate');
  }
  const path = join(tmpdir(), `autooffice-${Date.now()}.cer`);
  writeFileSync(path, certPem, 'utf8');
  try {
    await runPowerShell([
      '-NoProfile',
      '-Command',
      `Import-Certificate -FilePath '${path.replace(/'/g, "''")}' -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null`,
    ]);
  } finally {
    try { unlinkSync(path); } catch { /* noop */ }
  }
}

export async function uninstallCertByFingerprint(fingerprintHex: string): Promise<void> {
  if (process.platform !== 'win32') return;
  const fp = fingerprintHex.replace(/[^A-F0-9]/gi, '').toUpperCase();
  await runPowerShell([
    '-NoProfile',
    '-Command',
    `Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object { $_.Thumbprint -eq '${fp}' } | Remove-Item`,
  ]);
}

function runPowerShell(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('powershell.exe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`powershell exit ${code}: ${err}`));
    });
    proc.on('error', reject);
  });
}
