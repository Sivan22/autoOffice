// src/taskpane/skills/excel/index.ts
import contextSync from './context-sync.md?raw';
import workbook from './workbook.md?raw';
import worksheets from './worksheets.md?raw';
import ranges from './ranges.md?raw';
import formulas from './formulas.md?raw';
import numberFormats from './number-formats.md?raw';
import formatting from './formatting.md?raw';
import styles from './styles.md?raw';
import tables from './tables.md?raw';
import namedItems from './named-items.md?raw';
import charts from './charts.md?raw';
import pivotTables from './pivot-tables.md?raw';
import conditionalFormatting from './conditional-formatting.md?raw';
import dataValidation from './data-validation.md?raw';
import filtersSort from './filters-sort.md?raw';
import comments from './comments.md?raw';
import hyperlinks from './hyperlinks.md?raw';
import imagesShapes from './images-shapes.md?raw';
import protection from './protection.md?raw';
import events from './events.md?raw';
import ooxml from './ooxml.md?raw';

export const EXCEL_SKILL_NAMES = [
  'context-sync',
  'workbook',
  'worksheets',
  'ranges',
  'formulas',
  'number-formats',
  'formatting',
  'styles',
  'tables',
  'named-items',
  'charts',
  'pivot-tables',
  'conditional-formatting',
  'data-validation',
  'filters-sort',
  'comments',
  'hyperlinks',
  'images-shapes',
  'protection',
  'events',
  'ooxml',
] as const;
export type ExcelSkillName = (typeof EXCEL_SKILL_NAMES)[number];

export const EXCEL_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'workbook': workbook,
  'worksheets': worksheets,
  'ranges': ranges,
  'formulas': formulas,
  'number-formats': numberFormats,
  'formatting': formatting,
  'styles': styles,
  'tables': tables,
  'named-items': namedItems,
  'charts': charts,
  'pivot-tables': pivotTables,
  'conditional-formatting': conditionalFormatting,
  'data-validation': dataValidation,
  'filters-sort': filtersSort,
  'comments': comments,
  'hyperlinks': hyperlinks,
  'images-shapes': imagesShapes,
  'protection': protection,
  'events': events,
  'ooxml': ooxml,
};
