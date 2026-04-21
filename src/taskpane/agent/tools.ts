import { tool, jsonSchema } from 'ai';
import { lookupSkill, SKILL_NAMES } from '../skills/index.ts';

export const lookupSkillTool = tool({
  description: 'Fetch office.js API documentation for a specific domain. Call this before writing code to get the correct API patterns, types, and examples.',
  inputSchema: jsonSchema<{ name: string }>({
    type: 'object',
    properties: {
      name: { type: 'string', enum: SKILL_NAMES as unknown as string[] },
    },
    required: ['name'],
    additionalProperties: false,
  }),
  execute: async ({ name }) => lookupSkill(name as typeof SKILL_NAMES[number]),
});

export const executeCodeTool = tool({
  description:
    'Submit generated office.js code for execution in the sandbox. ' +
    'The code can be either a complete Word.run(async (context) => { ... }) block, ' +
    'or just the inner body (the executor wraps it automatically). ' +
    'Always use proper load() and context.sync() patterns.',
  inputSchema: jsonSchema<{ code: string }>({
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The office.js code to execute' },
    },
    required: ['code'],
    additionalProperties: false,
  }),
  // execute is handled by the orchestrator (needs postMessage bridge)
});

export const readDocumentStateTool = tool({
  description:
    'Get the current document context: selected text, headings outline, and cursor position. ' +
    'Call this to understand what the user is working with before generating code.',
  inputSchema: jsonSchema<Record<string, never>>({
    type: 'object',
    properties: {},
    additionalProperties: false,
  }),
  // execute is handled by the orchestrator (needs Office.js context)
});
