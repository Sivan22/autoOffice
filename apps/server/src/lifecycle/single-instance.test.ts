import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, releaseLock } from './single-instance';

describe('single-instance lock', () => {
  it('first acquirer wins, second is rejected, release allows re-acquire', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lk-'));
    try {
      const handle = acquireLock(dir);
      expect(handle).not.toBeNull();
      expect(acquireLock(dir)).toBeNull();
      releaseLock(handle!);
      const second = acquireLock(dir);
      expect(second).not.toBeNull();
      releaseLock(second!);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
