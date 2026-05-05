import { generateText, type LanguageModel } from 'ai';

const TITLE_PROMPT =
  'Generate a 3-6 word title for the following chat. ' +
  'Reply with only the title, no quotes, no punctuation, no surrounding text.';

const MAX_TITLE_LEN = 50;

type UIPart = { type: string; text?: unknown };
type UIMessage = { role: string; parts: unknown[] };

function textOfParts(parts: unknown[]): string {
  return parts
    .map((p) => {
      const part = p as UIPart;
      return part?.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

function transcriptOf(messages: UIMessage[]): string {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${textOfParts(m.parts ?? [])}`)
    .filter((line) => !line.endsWith(': '))
    .join('\n');
}

function clean(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^["'‘’“”]|["'‘’“”]$/g, '').trim();
  if (t.length > MAX_TITLE_LEN) t = t.slice(0, MAX_TITLE_LEN);
  return t;
}

export async function generateTitle(
  messages: UIMessage[],
  model: LanguageModel,
): Promise<string | null> {
  const transcript = transcriptOf(messages);
  if (!transcript) return null;
  try {
    const { text } = await generateText({
      model,
      prompt: `${transcript}\n\n${TITLE_PROMPT}`,
    });
    const cleaned = clean(text);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}
