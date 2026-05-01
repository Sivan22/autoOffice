// src/taskpane/agent/tools.ts
import { tool, jsonSchema } from 'ai';
import { lookupSkill, listSkills } from '../skills/index.ts';
import type { HostKind } from '../host/context.ts';

export function makeLookupSkillTool(host: HostKind) {
  const skills = listSkills(host);
  return tool({
    description:
      `Fetch office.js API documentation for a specific domain in ${host === 'word' ? 'Microsoft Word' : 'Microsoft Excel'}. ` +
      `Call this before writing code to get the correct API patterns, types, and examples. ` +
      `Available domains: ${skills.join(', ')}.`,
    inputSchema: jsonSchema<{ name: string }>({
      type: 'object',
      properties: {
        name: { type: 'string', enum: skills as unknown as string[] },
      },
      required: ['name'],
      additionalProperties: false,
    }),
    execute: async ({ name }) => lookupSkill(host, name),
  });
}
