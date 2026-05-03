// src/taskpane/skills/powerpoint/index.ts
import contextSync from './context-sync.md?raw';
import presentation from './presentation.md?raw';
import slides from './slides.md?raw';
import slideLayouts from './slide-layouts.md?raw';
import shapes from './shapes.md?raw';
import text from './text.md?raw';
import tables from './tables.md?raw';
import images from './images.md?raw';
import charts from './charts.md?raw';
import hyperlinks from './hyperlinks.md?raw';
import tags from './tags.md?raw';
import selection from './selection.md?raw';
import ooxml from './ooxml.md?raw';

export const POWERPOINT_SKILL_NAMES = [
  'context-sync',
  'presentation',
  'slides',
  'slide-layouts',
  'shapes',
  'text',
  'tables',
  'images',
  'charts',
  'hyperlinks',
  'tags',
  'selection',
  'ooxml',
] as const;
export type PowerPointSkillName = (typeof POWERPOINT_SKILL_NAMES)[number];

export const POWERPOINT_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'presentation': presentation,
  'slides': slides,
  'slide-layouts': slideLayouts,
  'shapes': shapes,
  'text': text,
  'tables': tables,
  'images': images,
  'charts': charts,
  'hyperlinks': hyperlinks,
  'tags': tags,
  'selection': selection,
  'ooxml': ooxml,
};
