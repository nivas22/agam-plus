import { defineConfig } from 'vitest/config';

// .mts because this package is consumed as source by bundlers and has no
// "type": "module" — a .ts config would be require()d and fail on Vite's
// ESM-only build.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
