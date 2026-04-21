import { streamText, type CoreMessage, type ToolCallPart, type ToolResultPart } from 'ai';
import { createModel } from './providers.ts';
import { lookupSkillTool, executeCodeTool, readDocumentStateTool } from './tools.ts';
import { lookupSkill } from '../skills/index.ts';
import type { AppSettings } from '../store/settings.ts';
import type { Sandbox } from '../executor/sandbox.ts';
import { getMcpTools } from '../mcp/client.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: {
    code: string;
    status: 'pending' | 'approved' | 'rejected' | 'running' | 'success' | 'error';
    error?: string;
    attempt?: number;
  };
  toolActivity?: {
    toolName: string;
    status: 'calling' | 'done';
    result?: string;
  };
}

const SYSTEM_PROMPT = `You are AutoOffice, an AI assistant that controls Microsoft Word by writing and executing office.js code.

You have tools to look up API documentation, execute code, and read the current document state.

Available skill topics for lookup_skill: formatting, tables, content-controls, styles, ranges, search, comments, headers-footers, images, lists, document, context-sync.

CRITICAL RULES for office.js code:
- You MUST load() properties before reading them
- You MUST await context.sync() after load() and before accessing values
- You MUST use Word.InsertLocation enum for insertion positions
- NEVER use DOM manipulation — only the office.js API
- Code runs in a sandboxed iframe with access to the Word object model

When the user asks you to do something with the document:
1. If unsure about the API, call lookup_skill first to get the right patterns
2. Optionally call read_document_state to understand the current context
3. Generate the code and call execute_code
4. If execution fails, analyze the error and try again (up to 3 attempts)

Your code can be either a full Word.run() block or just the inner body — the executor handles both.`;

export interface OrchestratorCallbacks {
  onMessage: (message: ChatMessage) => void;
  onUpdateLastMessage: (update: Partial<ChatMessage>) => void;
  onStreamToken: (token: string) => void;
  requestApproval: (code: string) => Promise<boolean>;
}

export async function runAgent(
  userMessage: string,
  conversationHistory: CoreMessage[],
  settings: AppSettings,
  sandbox: Sandbox,
  callbacks: OrchestratorCallbacks,
): Promise<CoreMessage[]> {
  const model = createModel(settings);
  const mcpTools = await getMcpTools(settings.mcpServers);

  const messages: CoreMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let retryCount = 0;

  // Agent loop — stream LLM response and handle tool calls
  while (true) {
    let assistantText = '';
    callbacks.onMessage({ role: 'assistant', content: '' });

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools: {
        lookup_skill: lookupSkillTool,
        execute_code: executeCodeTool,
        read_document_state: readDocumentStateTool,
        ...mcpTools,
      },
      maxSteps: 10,
      onStepFinish: async ({ toolCalls, toolResults }) => {
        if (!toolCalls || toolCalls.length === 0) return;

        for (const tc of toolCalls) {
          if (tc.toolName === 'lookup_skill') {
            callbacks.onMessage({
              role: 'assistant',
              content: '',
              toolActivity: { toolName: `lookup_skill(${(tc.args as { name: string }).name})`, status: 'done' },
            });
          }
        }
      },
    });

    // Stream text tokens
    try {
      for await (const chunk of result.textStream) {
        assistantText += chunk;
        callbacks.onStreamToken(chunk);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onMessage({ role: 'assistant', content: `Error: ${msg}` });
      return messages;
    }

    const response = await result;

    // Check for tool calls that we need to handle manually
    const toolCalls: ToolCallPart[] = [];
    const toolResults: ToolResultPart[] = [];

    for (const step of (response.steps ?? [])) {
      for (const tc of step.toolCalls) {
        if (tc.toolName === 'execute_code') {
          const code = (tc.args as { code: string }).code;

          callbacks.onMessage({
            role: 'assistant',
            content: '',
            codeBlock: { code, status: 'pending', attempt: retryCount + 1 },
          });

          // Request approval (or auto-approve)
          const approved = settings.autoApprove || await callbacks.requestApproval(code);

          if (!approved) {
            callbacks.onUpdateLastMessage({
              codeBlock: { code, status: 'rejected', attempt: retryCount + 1 },
            });

            // Tell the LLM the user rejected the code
            messages.push(
              { role: 'assistant', content: assistantText },
              {
                role: 'tool' as CoreMessage['role'],
                content: [{ type: 'tool-result', toolCallId: tc.toolCallId, result: 'User rejected the code. Ask what they would like changed.' }],
              } as CoreMessage,
            );
            break;
          }

          callbacks.onUpdateLastMessage({
            codeBlock: { code, status: 'running', attempt: retryCount + 1 },
          });

          // Execute in sandbox
          const execResult = await sandbox.execute(code, settings.executionTimeout);

          if (execResult.success) {
            callbacks.onUpdateLastMessage({
              codeBlock: { code, status: 'success', attempt: retryCount + 1 },
            });

            messages.push(
              { role: 'assistant', content: assistantText },
              {
                role: 'tool' as CoreMessage['role'],
                content: [{ type: 'tool-result', toolCallId: tc.toolCallId, result: `Code executed successfully. Output: ${JSON.stringify(execResult.output)}` }],
              } as CoreMessage,
            );
            retryCount = 0;
            return messages;
          }

          // Execution failed
          retryCount++;
          callbacks.onUpdateLastMessage({
            codeBlock: { code, status: 'error', error: execResult.error, attempt: retryCount },
          });

          if (retryCount >= settings.maxRetries) {
            callbacks.onMessage({
              role: 'assistant',
              content: `Failed after ${retryCount} attempts. Last error: ${execResult.error}`,
            });
            retryCount = 0;
            return messages;
          }

          // Feed error back to LLM for self-healing
          callbacks.onMessage({
            role: 'assistant',
            content: `Attempt ${retryCount} failed: ${execResult.error}. Retrying...`,
          });

          messages.push(
            { role: 'assistant', content: assistantText },
            {
              role: 'tool' as CoreMessage['role'],
              content: [{
                type: 'tool-result',
                toolCallId: tc.toolCallId,
                result: `Execution failed: ${execResult.error}\n${execResult.stack || ''}\nPlease fix and try again.`,
              }],
            } as CoreMessage,
          );
          continue;
        }

        if (tc.toolName === 'read_document_state') {
          callbacks.onMessage({
            role: 'assistant',
            content: '',
            toolActivity: { toolName: 'read_document_state', status: 'calling' },
          });

          const state = await readDocumentState();

          callbacks.onUpdateLastMessage({
            toolActivity: { toolName: 'read_document_state', status: 'done', result: state },
          });

          messages.push(
            { role: 'assistant', content: assistantText },
            {
              role: 'tool' as CoreMessage['role'],
              content: [{ type: 'tool-result', toolCallId: tc.toolCallId, result: state }],
            } as CoreMessage,
          );
        }
      }
    }

    // If no execute_code tool calls were made (just text response), we're done
    const hasExecuteCall = (response.steps ?? []).some(s =>
      s.toolCalls.some(tc => tc.toolName === 'execute_code')
    );
    if (!hasExecuteCall) {
      messages.push({ role: 'assistant', content: assistantText });
      return messages;
    }
  }
}

async function readDocumentState(): Promise<string> {
  try {
    return await Word.run(async (context) => {
      const body = context.document.body;
      const selection = context.document.getSelection();

      body.load('text');
      selection.load('text');

      const paragraphs = body.paragraphs;
      paragraphs.load('items');

      await context.sync();

      // Get headings outline
      const headings: string[] = [];
      for (const para of paragraphs.items) {
        para.load('style,text');
      }
      await context.sync();

      for (const para of paragraphs.items) {
        if (para.style && para.style.startsWith('Heading')) {
          headings.push(`${para.style}: ${para.text}`);
        }
      }

      return JSON.stringify({
        selectedText: selection.text || '(no selection)',
        headings: headings.length > 0 ? headings : ['(no headings found)'],
        bodyLength: body.text.length,
      });
    });
  } catch (e) {
    return JSON.stringify({ error: 'Could not read document state. Are you in an Office environment?' });
  }
}
