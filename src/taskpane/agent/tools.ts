import { tool } from 'ai';
import { z } from 'zod';
import { lookupSkill, SKILL_NAMES } from '../skills/index.ts';

export const lookupSkillTool = tool({
  description: 'Fetch office.js API documentation for a specific domain. Call this before writing code to get the correct API patterns, types, and examples.',
  parameters: z.object({
    name: z.enum(SKILL_NAMES),
  }),
  execute: async ({ name }) => lookupSkill(name),
});

export const executeCodeTool = tool({
  description:
    'Submit generated office.js code for execution in the sandbox. ' +
    'The code can be either a complete Word.run(async (context) => { ... }) block, ' +
    'or just the inner body (the executor wraps it automatically). ' +
    'Always use proper load() and context.sync() patterns.',
  parameters: z.object({
    code: z.string().describe('The office.js code to execute'),
  }),
  // execute is handled by the orchestrator (needs postMessage bridge)
});

export const readDocumentStateTool = tool({
  description:
    'Get the current document context: selected text, headings outline, and cursor position. ' +
    'Call this to understand what the user is working with before generating code.',
  parameters: z.object({}),
  // execute is handled by the orchestrator (needs Office.js context)
});
