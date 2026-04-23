export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  stack?: string;
  logs?: string[];
}

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
  log: (...args: unknown[]) => logs.push(args.map(formatArg).join(' ')),
  info: (...args: unknown[]) => logs.push('[info] ' + args.map(formatArg).join(' ')),
  warn: (...args: unknown[]) => logs.push('[warn] ' + args.map(formatArg).join(' ')),
  error: (...args: unknown[]) => logs.push('[error] ' + args.map(formatArg).join(' ')),
  debug: (...args: unknown[]) => logs.push('[debug] ' + args.map(formatArg).join(' ')),
});

export class Sandbox {
  init(): void {}
  destroy(): void {}

  async execute(code: string, timeout: number = 30000): Promise<ExecutionResult> {
    const trimmed = code.trim();
    const isWrapped = trimmed.startsWith('Word.run');
    const execCode = isWrapped
      ? `return (${trimmed.replace(/;+\s*$/, '')});`
      : `return Word.run(async function(context) {\n${code}\n});`;

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
