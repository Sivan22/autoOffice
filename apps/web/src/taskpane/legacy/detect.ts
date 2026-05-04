export type LegacyBlob = {
  roamingSettingsRaw: Record<string, unknown> | null;
  localStorageConvs: unknown[] | null;
};

export function detectLegacy(): LegacyBlob {
  const roamingSettingsRaw = readRoamingSettings();
  const localStorageConvs = readLocalStorageConvs();
  return { roamingSettingsRaw, localStorageConvs };
}

export function clearLegacy(): void {
  for (const k of LEGACY_LS_KEYS) {
    try { window.localStorage.removeItem(k); } catch { /* noop */ }
  }
  try {
    const rs = (Office as any)?.context?.roamingSettings;
    if (rs?.remove) {
      for (const k of LEGACY_RS_KEYS) rs.remove(k);
      rs.saveAsync?.(() => {});
    }
  } catch { /* noop */ }
}

const LEGACY_LS_KEYS = ['autoOffice.conversations', 'autoOffice.activeConversationId'];
const LEGACY_RS_KEYS = ['autoOffice.settings', 'autoOffice.providers', 'autoOffice.mcpServers'];

function readRoamingSettings(): Record<string, unknown> | null {
  try {
    const rs = (Office as any)?.context?.roamingSettings;
    if (!rs?.get) return null;
    const out: Record<string, unknown> = {};
    let hit = 0;
    for (const k of LEGACY_RS_KEYS) {
      const v = rs.get(k);
      if (v != null) { out[k] = v; hit += 1; }
    }
    return hit === 0 ? null : out;
  } catch {
    return null;
  }
}

function readLocalStorageConvs(): unknown[] | null {
  try {
    const raw = window.localStorage.getItem('autoOffice.conversations');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}
