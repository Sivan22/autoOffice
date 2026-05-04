import { describe, it, expect } from 'vitest';
import { listSkills, listSkillsForHost, readSkill } from './index';

describe('skills registry', () => {
  it('lists at least one .md skill', () => {
    expect(listSkills().length).toBeGreaterThan(0);
  });

  it('reads a skill body via scoped name', () => {
    const first = listSkills()[0]!;
    const body = readSkill(first);
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  it('returns null for unknown skill', () => {
    expect(readSkill('does_not_exist')).toBeNull();
  });

  it('listSkillsForHost returns word skills without prefix', () => {
    const words = listSkillsForHost('word');
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((s) => !s.includes('/'))).toBe(true);
  });

  it('readSkill resolves bare name by searching host dirs', () => {
    const wordSkills = listSkillsForHost('word');
    const candidate = wordSkills[0]!;
    expect(readSkill(candidate)).toBeTruthy();
  });

  it('rejects path traversal', () => {
    expect(readSkill('../foo')).toBeNull();
  });
});
