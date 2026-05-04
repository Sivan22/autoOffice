import type { LanguageModel } from 'ai';

/**
 * Build a deterministic in-server LanguageModel factory used for E2E tests.
 *
 * Behaviour:
 * - Always emits a single text part `Echo: <last user text>`.
 * - If the last user message contains the word "code" (case-insensitive), it
 *   additionally emits a `tool-call` for `execute_code` so the SPA renders
 *   the approval UI and the test suite can exercise the code-approval path.
 * - Always finishes cleanly with a `finish` part.
 *
 * Wired in `apps/server/src/app.ts` when `AUTOOFFICE_TEST_PROVIDER=fake`.
 */
export function makeTestProvider(): (providerId: string, modelId: string) => LanguageModel {
  return (_providerId, modelId) => ({
    specificationVersion: 'v2',
    provider: 'autooffice-test',
    modelId,
    async doStream({ prompt }: any) {
      const last = (prompt as any[]).at(-1);
      const userText = (last?.content ?? [])
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join(' ');
      const wantsCode = /code/i.test(userText);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't0' });
            controller.enqueue({ type: 'text-delta', id: 't0', delta: `Echo: ${userText}` });
            controller.enqueue({ type: 'text-end', id: 't0' });
            if (wantsCode) {
              // AI SDK v5 expects `input` as a serialized JSON string for v2
              // tool-call parts, then parses it server-side against the
              // tool's input schema.
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'tc0',
                toolName: 'execute_code',
                input: JSON.stringify({ code: 'await context.sync()' }),
              });
            }
            controller.enqueue({
              type: 'finish',
              finishReason: wantsCode ? 'tool-calls' : 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  } as unknown as LanguageModel);
}
