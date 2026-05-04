import { spawn } from 'node:child_process';

export type ProbeOutput = { exitCode: number; stdout: string; stderr: string };
export type ProbeStatus = 'ready' | 'cli-not-found' | 'cli-not-authed' | 'unknown';

export function classifyProbeOutput(o: ProbeOutput): ProbeStatus {
  if (o.exitCode === 0) return 'ready';
  if (o.exitCode < 0 || /ENOENT|not recognized|command not found/i.test(o.stderr)) return 'cli-not-found';
  if (/login|authent|sign[- ]?in|token/i.test(o.stderr) || /login|authent/i.test(o.stdout)) {
    return 'cli-not-authed';
  }
  return 'unknown';
}

export async function probeCli(opts: { binary: string; args: string[]; timeoutMs?: number }): Promise<ProbeStatus> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  return new Promise<ProbeStatus>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(opts.binary, opts.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve(classifyProbeOutput({ exitCode: -1, stdout: '', stderr: String(err) }));
      return;
    }
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { proc.kill('SIGKILL'); } catch {}
      resolve('unknown');
    }, timeoutMs);

    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(classifyProbeOutput({ exitCode: -1, stdout, stderr: stderr || String(err) }));
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(classifyProbeOutput({ exitCode: code ?? -1, stdout, stderr }));
    });
  });
}

export async function probeForKind(kind: string): Promise<ProbeStatus> {
  switch (kind) {
    case 'claude-code': return probeCli({ binary: 'claude', args: ['--version'] });
    case 'gemini-cli': return probeCli({ binary: 'gemini', args: ['--version'] });
    case 'opencode': return probeCli({ binary: 'opencode', args: ['--version'] });
    default: return 'ready';   // direct-API kinds: probe is a separate model dry-run, see /api/providers/:id/test
  }
}
