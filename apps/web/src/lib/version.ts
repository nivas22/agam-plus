import { versionFromVercelEnv, type VersionInfo } from "@agam/shared";

// Next inlines process.env references at build time, so these must be written
// out in full rather than looked up dynamically — `env[name]` would read as
// undefined in the browser bundle.
const env = {
  VERCEL_GIT_COMMIT_SHA: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  VERCEL_GIT_COMMIT_REF: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
};

/**
 * Safe to call from a client component: every value is baked into the bundle
 * at build time, and none of them is a secret.
 */
export function getVersion(): VersionInfo {
  return versionFromVercelEnv("web", "0.1.0", env);
}
