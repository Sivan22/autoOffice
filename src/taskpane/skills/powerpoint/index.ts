// src/taskpane/skills/powerpoint/index.ts

export const POWERPOINT_SKILL_NAMES = [] as const;
export type PowerPointSkillName = (typeof POWERPOINT_SKILL_NAMES)[number];

export const POWERPOINT_SKILLS: Record<string, string> = {};
