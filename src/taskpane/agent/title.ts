import { generateText, type ModelMessage } from 'ai';
import { createModel } from './providers.ts';
import type { AppSettings } from '../store/settings.ts';

const TITLE_PROMPT =
  'Generate a 3-6 word title for the following chat. ' +
  'Reply with only the title, no quotes, no punctuation, no surrounding text.';

const MAX_TITLE_LEN = 50;

function transcriptOf(messages: ModelMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role.toUpperCase();
      const content = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(p => 'text' in p && typeof p.text === 'string' ? p.text : '').join(' ').trim()
          : '';
      return `${role}: ${content}`;
    })
    .join('\n');
}

function clean(raw: string): string {
  let t = raw.trim();
  // Strip wrapping quotes / smart quotes
  t = t.replace(/^["'"']|["'"']$/g, '').trim();
  if (t.length > MAX_TITLE_LEN) t = t.slice(0, MAX_TITLE_LEN);
  return t;
}

export async function generateTitle(
  messages: ModelMessage[],
  settings: AppSettings,
): Promise<string | null> {
  let model;
  try {
    model = createModel(settings);
  } catch {
    return null;
  }

  try {
    const { text } = await generateText({
      model,
      prompt: `${transcriptOf(messages)}\n\n${TITLE_PROMPT}`,
    });
    const cleaned = clean(text);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}
