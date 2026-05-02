// src/taskpane/executor/sandbox.ts
import type { HostKind } from '../host/context.ts';

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  stack?: string;
  logs?: string[];
}

const NS: Record<HostKind, 'Word' | 'Excel' | 'PowerPoint'> = {
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
};

const formatArg = (a: unknown): string => {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack || a.message;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
};

const makeCapturingConsole = (logs: string[]) => ({
  log:   (...args: unknown[]) => logs.push(args.map(formatArg).join(' ')),
  info:  (...args: unknown[]) => logs.push('[info] '  + args.map(formatArg).join(' ')),
  warn:  (...args: unknown[]) => logs.push('[warn] '  + args.map(formatArg).join(' ')),
  error: (...args: unknown[]) => logs.push('[error] ' + args.map(formatArg).join(' ')),
  debug: (...args: unknown[]) => logs.push('[debug] ' + args.map(formatArg).join(' ')),
});

export class Sandbox {
  constructor(private readonly host: HostKind) {}

  init(): void {}
  destroy(): void {}

  async execute(code: string, timeout: number = 30000): Promise<ExecutionResult> {
    const ns = NS[this.host];
    const otherNamespaces = Object.values(NS).filter((n) => n !== ns);
    const trimmed = code.trim();

    // Reject code targeting the wrong host before running it. Yields a clear
    // error the agent can self-heal on, instead of an opaque "X is not defined".
    for (const other of otherNamespaces) {
      if (trimmed.startsWith(`${other}.run`)) {
        return {
          success: false,
          error: `Code uses ${other}.run but the add-in is running in ${ns}. Rewrite using ${ns}.run.`,
          logs: [],
        };
      }
    }

    const isWrapped = trimmed.startsWith(`${ns}.run`);
    const execCode = isWrapped
      ? `return (${trimmed.replace(/;+\s*$/, '')});`
      : `return ${ns}.run(async function(context) {\n${code}\n});`;

    const logs: string[] = [];
    const capturingConsole = makeCapturingConsole(logs);

    const timeoutPromise = new Promise<ExecutionResult>((resolve) =>
      setTimeout(
        () => resolve({ success: false, error: `Execution timed out after ${timeout}ms`, logs }),
        timeout
      )
    );

    const executionPromise = (async (): Promise<ExecutionResult> => {
      try {
        const fn = new Function('console', execCode);
        const result = await fn(capturingConsole);
        return { success: true, output: result, logs };
      } catch (err) {
        const e = err as Error;
        return { success: false, error: e.message || String(err), stack: e.stack, logs };
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }
}
