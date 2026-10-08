import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/{src,test}/**/*.test.ts', 'apps/server/{src,test}/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'apps/server/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', 'apps/server/src/main.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
    },
  },
});
