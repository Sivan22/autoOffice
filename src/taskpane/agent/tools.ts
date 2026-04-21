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
