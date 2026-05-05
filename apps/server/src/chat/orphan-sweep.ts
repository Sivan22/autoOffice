type Part = Record<string, unknown> & { type: string };
type Msg = { id: string; role: string; parts: Part[] };

// 'approval-responded' = user responded to an approval request; tool is queued to
// execute on the next round-trip — not orphaned, must not be overwritten.
const TERMINAL_STATES = new Set(['output-available', 'output-error', 'approval-responded']);

/**
 * Heal dangling tool-call parts before convertToModelMessages.
 *
 * When a server restart, network error, or aborted client turn left an assistant
 * tool-call without a matching tool-result, the AI SDK refuses to round-trip the
 * conversation through convertToModelMessages. This sweep walks each assistant
 * message, finds tool-* and dynamic-tool parts that are not in a terminal state
 * (output-available / output-error), and converts them to a synthetic
 * output-error so the conversation history is well-formed.
 */
export function sweepOrphans<T extends Msg>(messages: T[]): T[] {
  return messages.map((m) => {
    if (m.role !== 'assistant') return m;
    const parts = [...m.parts];
    let mutated = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const t = p.type as string;
      const isToolPart = t.startsWith('tool-') || t === 'dynamic-tool';
      if (!isToolPart) continue;
      const state = p.state as string | undefined;
      if (state && TERMINAL_STATES.has(state)) continue;
      parts[i] = {
        ...p,
        state: 'output-error',
        errorText: 'Tool result was not recorded (server restart or aborted turn).',
      };
      mutated = true;
    }
    if (!mutated) return m;
    return { ...m, parts };
  });
}
