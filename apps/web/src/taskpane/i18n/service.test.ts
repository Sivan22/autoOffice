import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationService } from './service.ts';
import { clearLoaderCache } from './loader.ts';

describe('TranslationService', () => {
  beforeEach(() => clearLoaderCache());

  it('returns the key itself before any locale is loaded', () => {
    const svc = new TranslationService();
    expect(svc.t('common.appName')).toBe('common.appName');
  });

  it('returns the active locale string after preload', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    expect(svc.t('common.appName')).toBe('AutoOffice');
    expect(svc.getLocale()).toBe('en');
  });

  it('switches locales and reflects new strings', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    await svc.setLocale('he');
    expect(svc.t('common.cancel')).toBe('ביטול');
    expect(svc.getLocale()).toBe('he');
  });

  it('falls back through the chain to en when a key is missing in the active locale', async () => {
    const svc = new TranslationService();
    await svc.setLocale('he');
    // Inject a synthetic missing key by stubbing the active dict.
    (svc as any).active = { ...((svc as any).active), common: { appName: 'AutoOffice' } };
    // 'common.cancel' no longer exists in stubbed he dict; falls back to en.
    expect(svc.t('common.cancel')).toBe('Cancel');
  });

  it('returns the key string when no locale (incl. en fallback) has it', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    expect(svc.t('does.not.exist' as any)).toBe('does.not.exist');
  });

  it('interpolates {{name}} placeholders from params', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    expect(svc.t('chat.welcomeMessage', { host: 'Word' })).toContain('Word');
    expect(svc.t('code.toolActivity', { toolName: 'lookup_skill' }))
      .toBe('looked up: lookup_skill');
  });

  it('subscribes/unsubscribes to locale changes', async () => {
    const svc = new TranslationService();
    let calls = 0;
    const off = svc.subscribe(() => { calls++; });
    await svc.setLocale('en');
    await svc.setLocale('he');
    off();
    await svc.setLocale('en');
    expect(calls).toBe(2);
  });
});
