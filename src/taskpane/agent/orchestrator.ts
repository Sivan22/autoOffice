import { streamText, tool, jsonSchema, stepCountIs, type ModelMessage } from 'ai';
import { createModel } from './providers.ts';
import { lookupSkillTool } from './tools.ts';
import type { AppSettings } from '../store/settings.ts';
import type { Sandbox } from '../executor/sandbox.ts';
import { getMcpTools } from '../mcp/client.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: {
    code: string;
    status: 'pending' | 'rejected' | 'running' | 'success' | 'error';
    error?: string;
  };
  toolActivity?: {
    toolName: string;
  };
}

const SYSTEM_PROMPT = `You are AutoOffice, an AI assistant that controls Microsoft Word by writing and executing office.js code.

You have tools to look up API documentation and execute code.

Available skill topics for lookup_skill: formatting, tables, content-controls, styles, ranges, search, comments, headers-footers, images, lists, document, context-sync, bookmarks, hyperlinks, footnotes, fields, track-changes, page-setup, ooxml.

CRITICAL RULES for office.js code:
- You MUST load() properties before reading them
- You MUST await context.sync() after load() and before accessing values
- You MUST use Word.InsertLocation enum for insertion positions
- NEVER use DOM manipulation — only the office.js API
- Code runs in a sandboxed iframe with access to the Word object model

When the user asks you to do something with the document:
1. ALWAYS call lookup_skill before writing code — it provides the correct API patterns, types, and examples for the relevant topic
2. To read document state, write execute_code that loads and returns the needed properties
3. Generate the code and call execute_code
4. If execution fails, analyze the error and try again (up to 3 attempts)

Your code can be either a full Word.run() block or just the inner body — the executor handles both.`;

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
      'The code can be either a complete Word.run(async (context) => { ... }) block, ' +
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
      if (!approved) return 'User rejected the code. Ask what they would like changed.';

      const result = await sandbox.execute(code, settings.executionTimeout);
      const logsStr = result.logs && result.logs.length ? `\nLogs:\n${result.logs.join('\n')}` : '';
      if (result.success) {
        return `Code executed successfully. Output: ${JSON.stringify(result.output)}${logsStr}`;
      }

      retryCount++;
      if (retryCount >= settings.maxRetries) {
        return `Failed after ${retryCount} attempts. Last error: ${result.error}${logsStr}`;
      }
      return `Execution failed: ${result.error}\n${result.stack || ''}${logsStr}\nPlease fix and try again.`;
    },
  });

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      lookup_skill: lookupSkillTool,
      execute_code: executeCode,
      ...mcpTools,
    },
    stopWhen: stepCountIs(settings.maxRetries + 5),
    onStepFinish: ({ toolCalls, toolResults }) => {
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const output = String((toolResults[i] as { output?: unknown })?.output ?? '');

        if (tc.toolName === 'execute_code') {
          const code = (tc.input as { code: string }).code;
          const status = output.startsWith('User rejected') ? 'rejected'
            : output.startsWith('Code executed successfully') ? 'success'
            : 'error';
          callbacks.onMessage({
            role: 'assistant',
            content: '',
            codeBlock: { code, status, error: status === 'error' ? output : undefined },
          });
        } else if (tc.toolName === 'lookup_skill') {
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
    callbacks.onMessage({ role: 'assistant', content: `Error: ${msg}` });
    return messages;
  }

  const response = await result.response;
  return [...messages, ...response.messages];
}
