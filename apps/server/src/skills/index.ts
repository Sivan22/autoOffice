import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_DIR = dirname(fileURLToPath(import.meta.url));

export type SkillName = string;

/**
 * List every available skill across hosts. Skill identifiers are returned in a
 * stable scoped form: `<host>/<name>` (e.g. `word/tables`, `excel/ranges`).
 * Bare top-level `*.md` files (if any) are returned without a prefix.
 */
export function listSkills(): SkillName[] {
  return collectSkills(SKILLS_DIR, '');
}

/**
 * List skills scoped to a host (e.g. `word`). Returns bare skill names
 * (without the host prefix). If the host directory does not exist, returns [].
 */
export function listSkillsForHost(host: string): SkillName[] {
  const dir = join(SKILLS_DIR, host);
  if (!existsDir(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

/**
 * Read a skill's markdown body. Accepts either a scoped name `<host>/<name>`
 * or a bare `<name>` (in which case it searches each host directory and the
 * top-level skills directory).
 */
export function readSkill(name: SkillName): string | null {
  if (name.includes('..')) return null;

  if (name.includes('/')) {
    const path = join(SKILLS_DIR, `${name}.md`);
    return safeRead(path);
  }

  const topLevel = safeRead(join(SKILLS_DIR, `${name}.md`));
  if (topLevel != null) return topLevel;

  for (const host of readdirSync(SKILLS_DIR)) {
    const dir = join(SKILLS_DIR, host);
    if (!existsDir(dir)) continue;
    const body = safeRead(join(dir, `${name}.md`));
    if (body != null) return body;
  }
  return null;
}

function collectSkills(dir: string, prefix: string): SkillName[] {
  const out: SkillName[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...collectSkills(full, prefix ? `${prefix}/${entry}` : entry));
    } else if (entry.endsWith('.md')) {
      const name = entry.replace(/\.md$/, '');
      out.push(prefix ? `${prefix}/${name}` : name);
    }
  }
  return out.sort();
}

function existsDir(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
