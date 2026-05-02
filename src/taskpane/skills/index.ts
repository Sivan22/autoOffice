// src/taskpane/skills/index.ts
import type { HostKind } from '../host/context.ts';
import { WORD_SKILLS, WORD_SKILL_NAMES } from './word/index.ts';
import { EXCEL_SKILLS, EXCEL_SKILL_NAMES } from './excel/index.ts';

export function listSkills(host: HostKind): readonly string[] {
  return host === 'word' ? WORD_SKILL_NAMES : EXCEL_SKILL_NAMES;
}

export function lookupSkill(host: HostKind, name: string): string {
  const table = host === 'word' ? WORD_SKILLS : EXCEL_SKILLS;
  const content = table[name];
  if (!content) {
    const available = listSkills(host).join(', ');
    return `Skill "${name}" not found for host "${host}". Available: ${available}`;
  }
  return content;
}
