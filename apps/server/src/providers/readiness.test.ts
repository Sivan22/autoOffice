import { describe, it, expect } from 'vitest';
import { probeCli, classifyProbeOutput } from './readiness';

describe('classifyProbeOutput', () => {
  it('treats normal --version output as ready', () => {
    expect(classifyProbeOutput({ exitCode: 0, stdout: '0.4.2\n', stderr: '' })).toBe('ready');
  });

  it('treats spawn failure as cli-not-found', () => {
    expect(classifyProbeOutput({ exitCode: -1, stdout: '', stderr: 'ENOENT' })).toBe('cli-not-found');
  });

  it('treats login-required messages as cli-not-authed', () => {
    expect(
      classifyProbeOutput({ exitCode: 1, stdout: '', stderr: 'Please run `claude login` first' }),
    ).toBe('cli-not-authed');
    expect(
      classifyProbeOutput({ exitCode: 1, stdout: '', stderr: 'Authentication required' }),
    ).toBe('cli-not-authed');
  });

  it('falls back to unknown on any other failure', () => {
    expect(classifyProbeOutput({ exitCode: 2, stdout: '', stderr: 'oops' })).toBe('unknown');
  });
});

describe('probeCli', () => {
  it('handles a missing binary gracefully', async () => {
    const status = await probeCli({ binary: 'this-binary-does-not-exist-please', args: ['--version'] });
    expect(status).toBe('cli-not-found');
  });
});
