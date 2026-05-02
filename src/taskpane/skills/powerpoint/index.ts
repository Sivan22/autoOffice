// src/taskpane/skills/powerpoint/index.ts
import contextSync from './context-sync.md?raw';

export const POWERPOINT_SKILL_NAMES = [
  'context-sync',
] as const;
export type PowerPointSkillName = (typeof POWERPOINT_SKILL_NAMES)[number];

export const POWERPOINT_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
};
