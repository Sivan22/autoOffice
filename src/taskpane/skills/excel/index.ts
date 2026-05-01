// src/taskpane/skills/excel/index.ts
import contextSync from './context-sync.md?raw';
import workbook from './workbook.md?raw';
import worksheets from './worksheets.md?raw';
import ranges from './ranges.md?raw';
import formulas from './formulas.md?raw';
import numberFormats from './number-formats.md?raw';

export const EXCEL_SKILL_NAMES = [
  'context-sync',
  'workbook',
  'worksheets',
  'ranges',
  'formulas',
  'number-formats',
] as const;
export type ExcelSkillName = (typeof EXCEL_SKILL_NAMES)[number];

export const EXCEL_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'workbook': workbook,
  'worksheets': worksheets,
  'ranges': ranges,
  'formulas': formulas,
  'number-formats': numberFormats,
};
