#!/usr/bin/env -S node --experimental-strip-types
// Verifies every registered locale's JSON has the same key shape as en.json.
// Exits non-zero on missing keys; warns on extras and likely-untranslated.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Json = { [k: string]: string | Json };

export function flattenKeys(obj: Json, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(path);
    else out.push(...flattenKeys(v as Json, path));
  }
  return out;
}

export function diffKeys(en: Json, other: Json): { missing: string[]; extra: string[] } {
  const a = new Set(flattenKeys(en));
  const b = new Set(flattenKeys(other));
  const missing = [...a].filter(k => !b.has(k)).sort();
  const extra = [...b].filter(k => !a.has(k)).sort();
  return { missing, extra };
}

function getNested(obj: Json, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

const PROPER_NOUN_KEYS = new Set([
  'common.appName',
  'settings.baseUrlPlaceholder',
  'settings.mcpUrlPlaceholder',
]);

async function main(): Promise<number> {
  const reg = await import('../src/taskpane/i18n/registry.ts');
  const en = JSON.parse(
    readFileSync(resolve('src/taskpane/i18n/locales/en.json'), 'utf8'),
  ) as Json;

  let failed = false;
  for (const id of Object.keys(reg.LOCALES)) {
    if (id === 'en') continue;
    const path = resolve(`src/taskpane/i18n/locales/${id}.json`);
    let other: Json;
    try {
      other = JSON.parse(readFileSync(path, 'utf8')) as Json;
    } catch (e) {
      console.error(`✗ ${id}: cannot read/parse ${path}: ${(e as Error).message}`);
      failed = true;
      continue;
    }
    const { missing, extra } = diffKeys(en, other);
    if (missing.length > 0) {
      failed = true;
      console.error(`✗ ${id}: missing ${missing.length} keys`);
      for (const k of missing) console.error(`    - ${k}`);
    }
    if (extra.length > 0) {
      console.warn(`! ${id}: ${extra.length} extra keys (not in en.json)`);
      for (const k of extra) console.warn(`    + ${k}`);
    }
    // Likely-untranslated: identical to en value, except whitelisted proper nouns.
    const untranslated: string[] = [];
    for (const key of flattenKeys(en)) {
      if (PROPER_NOUN_KEYS.has(key)) continue;
      const ev = getNested(en, key);
      const ov = getNested(other, key);
      if (typeof ev === 'string' && ev === ov) untranslated.push(key);
    }
    if (untranslated.length > 0) {
      console.warn(`! ${id}: ${untranslated.length} values identical to English (likely untranslated)`);
      for (const k of untranslated) console.warn(`    ~ ${k}`);
    }
    if (missing.length === 0 && extra.length === 0) {
      console.log(`✓ ${id}: ${flattenKeys(other).length} keys, complete`);
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => process.exit(code));
}
