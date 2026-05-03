import { isLocaleId, type LocaleId } from './registry.ts';

export const STORAGE_KEY = 'autooffice_language';

function roaming(): {
  get(k: string): string | null;
  set(k: string, v: string): void;
  saveAsync?: () => void;
} | null {
  try {
    const off = (globalThis as any).Office;
    const r = off?.context?.roamingSettings;
    if (r && typeof r.get === 'function' && typeof r.set === 'function') return r;
  } catch { /* ignore */ }
  return null;
}

export function loadStoredLocale(): LocaleId | null {
  try {
    const r = roaming();
    const raw = r ? r.get(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY);
    if (typeof raw === 'string' && isLocaleId(raw)) return raw;
  } catch { /* ignore */ }
  return null;
}

export function saveStoredLocale(id: LocaleId): void {
  try {
    const r = roaming();
    if (r) {
      r.set(STORAGE_KEY, id);
      r.saveAsync?.();
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch { /* silent: best-effort persistence */ }
}
