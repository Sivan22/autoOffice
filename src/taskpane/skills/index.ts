const SKILLS: Record<string, string> = {};

// Import skill files as raw text
import contextSync from './context-sync.md?raw';
import formatting from './formatting.md?raw';
import tables from './tables.md?raw';
import contentControls from './content-controls.md?raw';
import styles from './styles.md?raw';
import ranges from './ranges.md?raw';
import search from './search.md?raw';
import comments from './comments.md?raw';
import headersFooters from './headers-footers.md?raw';
import images from './images.md?raw';
import lists from './lists.md?raw';
import documentSkill from './document.md?raw';
import bookmarks from './bookmarks.md?raw';
import hyperlinks from './hyperlinks.md?raw';
import footnotes from './footnotes.md?raw';
import fields from './fields.md?raw';
import trackChanges from './track-changes.md?raw';
import pageSetup from './page-setup.md?raw';
import ooxml from './ooxml.md?raw';

SKILLS['context-sync'] = contextSync;
SKILLS['formatting'] = formatting;
SKILLS['tables'] = tables;
SKILLS['content-controls'] = contentControls;
SKILLS['styles'] = styles;
SKILLS['ranges'] = ranges;
SKILLS['search'] = search;
SKILLS['comments'] = comments;
SKILLS['headers-footers'] = headersFooters;
SKILLS['images'] = images;
SKILLS['lists'] = lists;
SKILLS['document'] = documentSkill;
SKILLS['bookmarks'] = bookmarks;
SKILLS['hyperlinks'] = hyperlinks;
SKILLS['footnotes'] = footnotes;
SKILLS['fields'] = fields;
SKILLS['track-changes'] = trackChanges;
SKILLS['page-setup'] = pageSetup;
SKILLS['ooxml'] = ooxml;

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
