import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // bun:sqlite + bun:ffi modules misbehave under vitest's default worker pool
    // when run via `bun --bun run vitest`. Forks single-fork keeps the bun runtime
    // happy and is fast enough for this codebase.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': new URL('../../packages/shared/src', import.meta.url).pathname,
    },
  },
});
