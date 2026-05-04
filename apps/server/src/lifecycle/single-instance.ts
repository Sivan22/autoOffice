import { openSync, closeSync, writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type LockHandle = { dir: string; fd: number };

const LOCK_NAME = '.lock';

export function acquireLock(dir: string): LockHandle | null {
  const path = join(dir, LOCK_NAME);
  if (existsSync(path)) {
    const pid = Number(readFileSync(path, 'utf8') || '0');
    if (pid > 0 && isAlive(pid)) return null;
    // stale — clean up
    try { unlinkSync(path); } catch { /* noop */ }
  }
  try {
    const fd = openSync(path, 'wx');
    writeFileSync(path, String(process.pid));
    return { dir, fd };
  } catch {
    return null;
  }
}

export function releaseLock(handle: LockHandle): void {
  try { closeSync(handle.fd); } catch { /* noop */ }
  try { unlinkSync(join(handle.dir, LOCK_NAME)); } catch { /* noop */ }
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
