type ToolCall = {
  toolCall: {
    toolName: string;
    toolCallId: string;
    input: unknown;
    dynamic: boolean;
  };
};

type AddToolOutput = (args: {
  tool: string;
  toolCallId: string;
  output?: unknown;
  state?: 'output-error';
  errorText?: string;
}) => void;

export function makeOnToolCall(deps: {
  runInIframe: (code: string) => Promise<unknown>;
  addToolOutput: AddToolOutput;
  isAutoApprove: () => boolean;
}) {
  return async ({ toolCall }: ToolCall) => {
    if (toolCall.dynamic) return;
    if (toolCall.toolName !== 'execute_code') return;
    if (!deps.isAutoApprove()) return;
    try {
      const code = (toolCall.input as { code: string }).code;
      const output = await deps.runInIframe(code);
      deps.addToolOutput({
        tool: 'execute_code',
        toolCallId: toolCall.toolCallId,
        output,
      });
    } catch (err) {
      deps.addToolOutput({
        tool: 'execute_code',
        toolCallId: toolCall.toolCallId,
        state: 'output-error',
        errorText: (err as Error).message,
      });
    }
  };
}
