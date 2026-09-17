import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.e2e-spec.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    // E2E specs share one real Postgres instance and mutate global state
    // (users, activos, sync log), so files must run one at a time.
    fileParallelism: false,
  },
});
