import { isLocaleId, type LegacyImportPayload } from '@autooffice/shared';
import type { LegacyBlob } from './detect';

export function pack(blob: LegacyBlob): LegacyImportPayload | null {
  const settingsRaw = blob.roamingSettingsRaw?.['autoOffice.settings'] as Record<string, unknown> | undefined;
  const settings = settingsRaw
    ? {
        locale:
          typeof settingsRaw.locale === 'string' && isLocaleId(settingsRaw.locale)
            ? settingsRaw.locale
            : undefined,
        autoApprove: typeof settingsRaw.autoApprove === 'boolean' ? settingsRaw.autoApprove : undefined,
        maxSteps: typeof settingsRaw.maxSteps === 'number' ? settingsRaw.maxSteps : undefined,
      }
    : undefined;

  const conversations = (blob.localStorageConvs ?? []).map((c: any, idx: number) => ({
    id: typeof c.id === 'string' ? c.id : `c_legacy_${idx}`,
    title: typeof c.title === 'string' ? c.title : null,
    host: (c.host === 'excel' || c.host === 'powerpoint') ? c.host : 'word',
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
    messages: Array.isArray(c.messages) ? c.messages : [],
  }));

  if (!settings && conversations.length === 0) return null;
  return { settings, conversations };
}
