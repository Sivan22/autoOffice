import { describe, it, expect } from 'vitest';
import { systemPromptForHost } from './system-prompt';

describe('systemPromptForHost', () => {
  it('mentions Word for word host', () => {
    expect(systemPromptForHost('word')).toMatch(/Word/);
  });
  it('mentions Excel for excel host', () => {
    expect(systemPromptForHost('excel')).toMatch(/Excel/);
  });
  it('mentions PowerPoint for powerpoint host', () => {
    expect(systemPromptForHost('powerpoint')).toMatch(/PowerPoint/);
  });
});
