import { streamText, tool, jsonSchema, stepCountIs, type ModelMessage } from 'ai';
import { createModel } from './providers.ts';
import { makeLookupSkillTool } from './tools.ts';
import { buildSystemPrompt } from './system-prompt.ts';
import { listSkills } from '../skills/index.ts';
import type { HostKind } from '../host/context.ts';
import type { AppSettings } from '../store/settings.ts';
import type { Sandbox } from '../executor/sandbox.ts';
import { getMcpTools } from '../mcp/client.ts';
import { translationService } from '../i18n/service.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: {
    code: string;
    status: 'pending' | 'rejected' | 'running' | 'success' | 'error';
    result?: string;
  };
  toolActivity?: {
    toolName: string;
  };
}

export interface OrchestratorCallbacks {
  onMessage: (message: ChatMessage) => void;
  onStreamToken: (token: string) => void;
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
  const mcpTools = await getMcpTools(settings.mcpServers);

  const messages: ModelMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let retryCount = 0;
  callbacks.onMessage({ role: 'assistant', content: '' });

  const executeCode = tool({
    description:
      'Submit generated office.js code for execution in the sandbox. ' +
      `The code can be either a complete ${host === 'word' ? 'Word' : 'Excel'}.run(async (context) => { ... }) block, ` +
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
    execute: async ({ code }) => {
      const approved = settings.autoApprove || await callbacks.requestApproval(code);
      if (!approved) {
        callbacks.onMessage({
          role: 'assistant',
          content: '',
          codeBlock: { code, status: 'rejected' },
        });
        return translationService.t('errors.codeRejected');
      }

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
        callbacks.onMessage({
          role: 'assistant',
          content: '',
          codeBlock: { code, status: 'success', result: uiResult },
        });
        return `Code executed successfully. Output: ${JSON.stringify(result.output)}${logsStr}`;
      }

      const uiResult = [
        `Error: ${result.error}`,
        result.stack || '',
        result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
      ].filter(Boolean).join('\n\n');
      callbacks.onMessage({
        role: 'assistant',
        content: '',
        codeBlock: { code, status: 'error', result: uiResult },
      });

      retryCount++;
      if (retryCount >= settings.maxRetries) {
        return translationService.t('errors.maxRetriesReached', { count: retryCount, error: result.error || 'Unknown error' }) + logsStr;
      }
      return translationService.t('errors.executionFailed', { message: result.error || 'Unknown error' }) + `\n${result.stack || ''}${logsStr}\n` + translationService.t('errors.pleaseFixAndRetry');
    },
  });

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

  try {
    for await (const chunk of result.textStream) {
      callbacks.onStreamToken(chunk);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onMessage({ 
      role: 'assistant', 
      content: translationService.t('errors.streamError', { message: msg })
    });
    return messages;
  }

  const response = await result.response;
  return [...messages, ...response.messages];
}
