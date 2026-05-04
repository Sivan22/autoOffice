import { tool } from 'ai';
import * as z from 'zod';

// Client-side tool: NO execute fn. The browser's onToolCall in useChat
// resolves it by running the code in the sandboxed iframe.
export function makeExecuteCodeTool() {
  return tool({
    description:
      'Execute JavaScript against the live Office document via the sandboxed iframe. The code receives an Office context and must call await context.sync(). Returns the function\'s return value or an error.',
    inputSchema: z.object({
      code: z
        .string()
        .describe(
          'JavaScript source. Must be a top-level body, not a function declaration.',
        ),
    }),
    // No execute → AI SDK forwards the call to the client.
  });
}
