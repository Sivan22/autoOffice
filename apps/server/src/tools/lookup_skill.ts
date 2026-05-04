import { tool } from 'ai';
import * as z from 'zod';
import { listSkills, listSkillsForHost, readSkill } from '../skills/index';

export type LookupSkillOptions = {
  /**
   * Optional host scope. When provided, the tool's "available skills" hint is
   * limited to that host's catalog. Lookups still resolve via readSkill which
   * will accept either a bare or scoped name.
   */
  host?: string;
};

export function makeLookupSkillTool(opts: LookupSkillOptions = {}) {
  return tool({
    description:
      'Fetch office.js API documentation for a domain (e.g. "tables", "ranges", "formatting"). Use this BEFORE generating code that touches a domain you have not read about in this conversation.',
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          'The skill name (e.g. "tables"). Call once per domain.',
        ),
    }),
    execute: async ({ name }) => {
      const body = readSkill(name);
      if (body == null) {
        const available = opts.host
          ? listSkillsForHost(opts.host).join(', ')
          : listSkills().join(', ');
        return { error: `Unknown skill '${name}'. Available: ${available}` };
      }
      return { name, body };
    },
  });
}
