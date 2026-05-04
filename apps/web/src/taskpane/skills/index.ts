// src/taskpane/skills/index.ts
import type { HostKind } from '../host/context.ts';
import { WORD_SKILLS, WORD_SKILL_NAMES } from './word/index.ts';
import { EXCEL_SKILLS, EXCEL_SKILL_NAMES } from './excel/index.ts';
import { POWERPOINT_SKILLS, POWERPOINT_SKILL_NAMES } from './powerpoint/index.ts';

const TABLES: Record<HostKind, Record<string, string>> = {
  word: WORD_SKILLS,
  excel: EXCEL_SKILLS,
  powerpoint: POWERPOINT_SKILLS,
};

const NAMES: Record<HostKind, readonly string[]> = {
  word: WORD_SKILL_NAMES,
  excel: EXCEL_SKILL_NAMES,
  powerpoint: POWERPOINT_SKILL_NAMES,
};

export function listSkills(host: HostKind): readonly string[] {
  return NAMES[host];
}

export function lookupSkill(host: HostKind, name: string): string {
  const table = TABLES[host];
  const content = table[name];
  if (!content) {
    const available = listSkills(host).join(', ');
    return `Skill "${name}" not found for host "${host}". Available: ${available}`;
  }
  return content;
}
