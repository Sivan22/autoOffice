import { describe, it, expect } from 'vitest';
import { makeTestProvider } from './test-provider';

async function drain(stream: ReadableStream): Promise<any[]> {
  const reader = stream.getReader();
  const out: any[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

describe('makeTestProvider', () => {
  it('echoes the last user text and emits a clean finish', async () => {
    const factory = makeTestProvider();
    const model = factory('p_fake', 'fake-1') as any;
    const res = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    });
    const events = await drain(res.stream);
    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => e.delta)
      .join('');
    expect(text).toBe('Echo: hello');
    expect(events.at(-1)?.type).toBe('finish');
    expect(events.find((e) => e.type === 'tool-call')).toBeUndefined();
  });

  it('emits an execute_code tool-call when the user message mentions "code"', async () => {
    const factory = makeTestProvider();
    const model = factory('p_fake', 'fake-1') as any;
    const res = await model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'please write code' }] }],
    });
    const events = await drain(res.stream);
    const toolCall = events.find((e) => e.type === 'tool-call');
    expect(toolCall).toBeDefined();
    expect(toolCall.toolName).toBe('execute_code');
  });

  it('returns a model with provider id "autooffice-test"', () => {
    const factory = makeTestProvider();
    const model = factory('p_fake', 'fake-1') as any;
    expect(model.provider).toBe('autooffice-test');
    expect(model.modelId).toBe('fake-1');
  });
});
