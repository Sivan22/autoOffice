import contextSync       from './word/context-sync.md?raw';
import formatting        from './word/formatting.md?raw';
import tables            from './word/tables.md?raw';
import contentControls   from './word/content-controls.md?raw';
import styles            from './word/styles.md?raw';
import ranges            from './word/ranges.md?raw';
import search            from './word/search.md?raw';
import comments          from './word/comments.md?raw';
import headersFooters    from './word/headers-footers.md?raw';
import images            from './word/images.md?raw';
import lists             from './word/lists.md?raw';
import documentSkill     from './word/document.md?raw';
import bookmarks         from './word/bookmarks.md?raw';
import hyperlinks        from './word/hyperlinks.md?raw';
import footnotes         from './word/footnotes.md?raw';
import fields            from './word/fields.md?raw';
import trackChanges      from './word/track-changes.md?raw';
import pageSetup         from './word/page-setup.md?raw';
import ooxml             from './word/ooxml.md?raw';

const SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'formatting': formatting,
  'tables': tables,
  'content-controls': contentControls,
  'styles': styles,
  'ranges': ranges,
  'search': search,
  'comments': comments,
  'headers-footers': headersFooters,
  'images': images,
  'lists': lists,
  'document': documentSkill,
  'bookmarks': bookmarks,
  'hyperlinks': hyperlinks,
  'footnotes': footnotes,
  'fields': fields,
  'track-changes': trackChanges,
  'page-setup': pageSetup,
  'ooxml': ooxml,
};

export const SKILL_NAMES = [
  'formatting', 'tables', 'content-controls', 'styles',
  'ranges', 'search', 'comments', 'headers-footers',
  'images', 'lists', 'document', 'context-sync',
  'bookmarks', 'hyperlinks', 'footnotes', 'fields',
  'track-changes', 'page-setup', 'ooxml',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

export function lookupSkill(name: SkillName): string {
  const content = SKILLS[name];
  if (!content) {
    return `Skill "${name}" not found. Available skills: ${SKILL_NAMES.join(', ')}`;
  }
  return content;
}
