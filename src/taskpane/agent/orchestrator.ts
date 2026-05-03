import { streamText, tool, jsonSchema, stepCountIs, type ModelMessage } from 'ai';
import { createModel } from './providers.ts';
import { makeLookupSkillTool } from './tools.ts';
import { buildSystemPrompt } from './system-prompt.ts';
import { listSkills } from '../skills/index.ts';
import type { HostKind } from '../host/context.ts';
import type { AppSettings } from '../store/settings.ts';
import type { Sandbox } from '../executor/sandbox.ts';
import { getMcpTools } from '../mcp/client.ts';
import { formatError, type FormattedError } from './errors.ts';
import { extractPartialStringField } from './partial-json.ts';

export type CodeBlockStatus = 'streaming' | 'pending' | 'rejected' | 'running' | 'success' | 'error';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: {
    toolCallId?: string;
    code: string;
    status: CodeBlockStatus;
    result?: string;
  };
  toolActivity?: {
    toolName: string;
  };
  error?: FormattedError;
}

export interface OrchestratorCallbacks {
  onMessage: (message: ChatMessage) => void;
  onStreamToken: (token: string) => void;
  /**
   * Upsert a code-block message addressed by toolCallId. If no message with
   * that id exists, a new assistant message is appended; otherwise the
   * existing codeBlock is patched in place.
   */
  onUpsertCodeBlock: (
    toolCallId: string,
    patch: { code?: string; status?: CodeBlockStatus; result?: string },
  ) => void;
  requestApproval: (code: string) => Promise<boolean>;
}

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  settings: AppSettings,
  sandbox: Sandbox,
  host: HostKind,
  callbacks: OrchestratorCallbacks,
): Promise<ModelMessage[]> {
  const model = createModel(settings);
  const { tools: mcpTools, failures: mcpFailures } = await getMcpTools(settings.mcpServers);
  for (const f of mcpFailures) {
    callbacks.onMessage({
      role: 'assistant',
      content: '',
      error: formatError(f.error, { phase: 'mcp-connect', serverName: f.serverName }),
    });
  }

  const messages: ModelMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let retryCount = 0;
  callbacks.onMessage({ role: 'assistant', content: '' });

  const executeCode = tool({
    description:
      'Submit generated office.js code for execution in the sandbox. ' +
      `The code can be either a complete ${host === 'word' ? 'Word' : host === 'excel' ? 'Excel' : 'PowerPoint'}.run(async (context) => { ... }) block, ` +
      'or just the inner body (the executor wraps it automatically). ' +
      'Always use proper load() and context.sync() patterns. ' +
      'If you are unsure about the correct API, call lookup_skill first to get the right patterns and examples.',
    inputSchema: jsonSchema<{ code: string }>({
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The office.js code to execute' },
      },
      required: ['code'],
      additionalProperties: false,
    }),
    execute: async ({ code }, { toolCallId }) => {
      try {
        if (!settings.autoApprove) {
          callbacks.onUpsertCodeBlock(toolCallId, { code, status: 'pending' });
        }
        const approved = settings.autoApprove || await callbacks.requestApproval(code);
        if (!approved) {
          callbacks.onUpsertCodeBlock(toolCallId, { code, status: 'rejected' });
          return 'User rejected the code. Ask what they would like changed.';
        }

        callbacks.onUpsertCodeBlock(toolCallId, { code, status: 'running' });

        const result = await sandbox.execute(code, settings.executionTimeout);
        const logsStr = result.logs && result.logs.length ? `\nLogs:\n${result.logs.join('\n')}` : '';

        if (result.success) {
          const outputText = result.output === undefined
            ? 'undefined'
            : typeof result.output === 'string'
              ? result.output
              : JSON.stringify(result.output, null, 2);
          const uiResult = [
            `Output:\n${outputText}`,
            result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
          ].filter(Boolean).join('\n\n');
          callbacks.onUpsertCodeBlock(toolCallId, { code, status: 'success', result: uiResult });
          return `Code executed successfully. Output: ${JSON.stringify(result.output)}${logsStr}`;
        }

        const debugSection = result.debugInfo
          ? [
              'Office.js debug info:',
              `Code: ${result.debugInfo.code ?? ''}`,
              `Location: ${result.debugInfo.errorLocation ?? ''}`,
              `Statement: ${result.debugInfo.statement ?? ''}`,
              result.debugInfo.surroundingStatements && result.debugInfo.surroundingStatements.length
                ? `Surrounding:\n${result.debugInfo.surroundingStatements.join('\n')}`
                : '',
            ].filter(Boolean).join('\n')
          : '';
        const uiResult = [
          `Error: ${result.error}`,
          result.stack || '',
          debugSection,
          result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
        ].filter(Boolean).join('\n\n');
        callbacks.onUpsertCodeBlock(toolCallId, { code, status: 'error', result: uiResult });

        retryCount++;
        if (retryCount >= settings.maxRetries) {
          return `Failed after ${retryCount} attempts. Last error: ${result.error}${debugSection ? `\n${debugSection}` : ''}${logsStr}`;
        }
        return `Execution failed: ${result.error}\n${result.stack || ''}${debugSection ? `\n${debugSection}` : ''}${logsStr}\nPlease fix and try again.`;
      } catch (err) {
        const formatted = formatError(err, { phase: 'tool-execute', tool: 'execute_code' });
        callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
        return `Tool failed: ${formatted.title}. ${formatted.detail}`;
      }
    },
  });

  let capturedStreamError: unknown;

  const result = streamText({
    model,
    system: buildSystemPrompt(host, listSkills(host)),
    messages,
    tools: {
      lookup_skill: makeLookupSkillTool(host),
      execute_code: executeCode,
      ...mcpTools,
    },
    stopWhen: stepCountIs(settings.maxRetries + 5),
    onError: ({ error }) => {
      capturedStreamError = error;
    },
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        if (tc.toolName === 'lookup_skill') {
          callbacks.onMessage({
            role: 'assistant',
            content: '',
            toolActivity: { toolName: (tc.input as { name: string }).name },
          });
        }
      }

      if (toolCalls.length > 0) {
        callbacks.onMessage({ role: 'assistant', content: '' });
      }
    },
  });

  // Per-tool-call state for streaming `execute_code` input.
  const codeStreamBuffers = new Map<string, string>();

  try {
    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          callbacks.onStreamToken(chunk.text);
          break;

        case 'tool-input-start':
          if (chunk.toolName === 'execute_code') {
            codeStreamBuffers.set(chunk.id, '');
            callbacks.onUpsertCodeBlock(chunk.id, { code: '', status: 'streaming' });
          }
          break;

        case 'tool-input-delta': {
          const buf = codeStreamBuffers.get(chunk.id);
          if (buf === undefined) break;
          const next = buf + chunk.delta;
          codeStreamBuffers.set(chunk.id, next);
          const code = extractPartialStringField(next, 'code');
          if (code !== null) {
            callbacks.onUpsertCodeBlock(chunk.id, { code });
          }
          break;
        }

        case 'tool-input-end':
          codeStreamBuffers.delete(chunk.id);
          break;
      }
    }
    if (capturedStreamError) throw capturedStreamError;
  } catch (err) {
    const provider = settings.providers.find(p => p.id === settings.selectedProviderId)?.name;
    const formatted = formatError(capturedStreamError ?? err, {
      phase: 'stream',
      provider,
      model: settings.selectedModel,
    });
    callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
    return messages;
  }

  const response = await result.response;
  return [...messages, ...response.messages];
}
