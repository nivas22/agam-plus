import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pin to the hospital's local timezone so local-date derivation bugs
    // (e.g. toISODate) don't silently pass on a UTC CI box.
    env: {
      TZ: "Asia/Kolkata",
    },
  },
});
