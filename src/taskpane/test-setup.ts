import '@testing-library/jest-dom/vitest';

// jsdom does not implement crypto.randomUUID by default in some setups.
// Provide a deterministic-ish polyfill so tests don't need to stub it.
if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
  let counter = 0;
  globalThis.crypto = {
    ...(globalThis.crypto ?? {}),
    randomUUID: () => `test-uuid-${++counter}-${Date.now()}` as `${string}-${string}-${string}-${string}-${string}`,
  } as Crypto;
}
