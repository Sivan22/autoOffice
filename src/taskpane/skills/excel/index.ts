// src/taskpane/skills/excel/index.ts
export const EXCEL_SKILL_NAMES = [] as const;
export type ExcelSkillName = (typeof EXCEL_SKILL_NAMES)[number];
export const EXCEL_SKILLS: Record<string, string> = {};
