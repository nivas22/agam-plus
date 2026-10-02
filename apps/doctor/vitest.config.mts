import { defineConfig } from 'vitest/config';

// .mts, not .ts: this package is CommonJS (Metro and the Expo entry point
// expect that), so vitest would `require()` a .ts config and fail on Vite's
// ESM-only build. The explicit .mts extension makes Node load it as ESM.
//
// Only the pure domain logic is covered here. Component tests would need the
// React Native preset and a renderer; the ordering rules are what carry real
// risk, and they are plain functions over numbers.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
