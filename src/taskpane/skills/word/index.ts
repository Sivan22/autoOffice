// src/taskpane/skills/word/index.ts
import contextSync       from './context-sync.md?raw';
import formatting        from './formatting.md?raw';
import tables            from './tables.md?raw';
import contentControls   from './content-controls.md?raw';
import styles            from './styles.md?raw';
import ranges            from './ranges.md?raw';
import search            from './search.md?raw';
import comments          from './comments.md?raw';
import headersFooters    from './headers-footers.md?raw';
import images            from './images.md?raw';
import lists             from './lists.md?raw';
import documentSkill     from './document.md?raw';
import bookmarks         from './bookmarks.md?raw';
import hyperlinks        from './hyperlinks.md?raw';
import footnotes         from './footnotes.md?raw';
import fields            from './fields.md?raw';
import trackChanges      from './track-changes.md?raw';
import pageSetup         from './page-setup.md?raw';
import ooxml             from './ooxml.md?raw';

export const WORD_SKILL_NAMES = [
  'formatting', 'tables', 'content-controls', 'styles',
  'ranges', 'search', 'comments', 'headers-footers',
  'images', 'lists', 'document', 'context-sync',
  'bookmarks', 'hyperlinks', 'footnotes', 'fields',
  'track-changes', 'page-setup', 'ooxml',
] as const;

export type WordSkillName = (typeof WORD_SKILL_NAMES)[number];

export const WORD_SKILLS: Record<string, string> = {
  'context-sync': contextSync, 'formatting': formatting, 'tables': tables,
  'content-controls': contentControls, 'styles': styles, 'ranges': ranges,
  'search': search, 'comments': comments, 'headers-footers': headersFooters,
  'images': images, 'lists': lists, 'document': documentSkill,
  'bookmarks': bookmarks, 'hyperlinks': hyperlinks, 'footnotes': footnotes,
  'fields': fields, 'track-changes': trackChanges, 'page-setup': pageSetup,
  'ooxml': ooxml,
};
