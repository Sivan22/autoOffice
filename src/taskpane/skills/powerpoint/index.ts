// src/taskpane/skills/powerpoint/index.ts
import contextSync from './context-sync.md?raw';
import presentation from './presentation.md?raw';
import slides from './slides.md?raw';
import slideLayouts from './slide-layouts.md?raw';
import shapes from './shapes.md?raw';
import text from './text.md?raw';

export const POWERPOINT_SKILL_NAMES = [
  'context-sync',
  'presentation',
  'slides',
  'slide-layouts',
  'shapes',
  'text',
] as const;
export type PowerPointSkillName = (typeof POWERPOINT_SKILL_NAMES)[number];

export const POWERPOINT_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'presentation': presentation,
  'slides': slides,
  'slide-layouts': slideLayouts,
  'shapes': shapes,
  'text': text,
};
