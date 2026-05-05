import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema, ConversationSchema, MessageSchema } from './index';

describe('SettingsSchema', () => {
  it('produces sane defaults from {}', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      locale: 'en',
      autoApprove: false,
      maxSteps: 20,
      selectedProviderId: null,
      selectedModelId: null,
    });
  });

  it('rejects maxSteps below 1', () => {
    expect(() => SettingsSchema.parse({ maxSteps: 0 })).toThrow();
  });

  it('rejects an unknown locale id', () => {
    expect(() => SettingsSchema.parse({ locale: 'zz' })).toThrow();
  });
});

describe('ConversationSchema', () => {
  it('rejects invalid host', () => {
    expect(() =>
      ConversationSchema.parse({
        id: 'c_1',
        title: null,
        host: 'outlook',
        providerId: null,
        modelId: null,
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toThrow();
  });
});

describe('MessageSchema', () => {
  it('accepts an empty parts array', () => {
    const m = MessageSchema.parse({
      id: 'm_1',
      conversationId: 'c_1',
      role: 'user',
      parts: [],
      metadata: null,
      createdAt: 1,
    });
    expect(m.parts).toEqual([]);
  });
});
