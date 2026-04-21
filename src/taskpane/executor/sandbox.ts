export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  stack?: string;
}

export class Sandbox {
  init(): void {}
  destroy(): void {}

  async execute(code: string, timeout: number = 30000): Promise<ExecutionResult> {
    const isWrapped = code.trim().startsWith('Word.run');
    const execCode = isWrapped
      ? code
      : `return Word.run(async function(context) {\n${code}\n});`;

    const timeoutPromise = new Promise<ExecutionResult>((resolve) =>
      setTimeout(() => resolve({ success: false, error: `Execution timed out after ${timeout}ms` }), timeout)
    );

    const executionPromise = (async (): Promise<ExecutionResult> => {
      try {
        const fn = new Function(execCode);
        const result = await fn();
        return { success: true, output: result };
      } catch (err) {
        const e = err as Error;
        return { success: false, error: e.message || String(err), stack: e.stack };
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }
}
