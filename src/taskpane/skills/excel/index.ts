// src/taskpane/skills/excel/index.ts
import contextSync from './context-sync.md?raw';
import workbook from './workbook.md?raw';
import worksheets from './worksheets.md?raw';

export const EXCEL_SKILL_NAMES = [
  'context-sync',
  'workbook',
  'worksheets',
] as const;
export type ExcelSkillName = (typeof EXCEL_SKILL_NAMES)[number];

export const EXCEL_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'workbook': workbook,
  'worksheets': worksheets,
};
