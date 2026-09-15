/**
 * Build identity for the API.
 *
 * This deliberately does NOT import @agam/shared, unlike apps/web and
 * apps/doctor. The API compiles with `module: nodenext` and emits to dist/
 * via `nest build`; pulling in a workspace package that ships raw TypeScript
 * would drag those files into the emit and move `dist/main`, which is exactly
 * what apps/api/vercel.json and `start:prod` point at. The shape below is
 * kept identical to VersionInfo in @agam/shared by hand — if you change one,
 * change both.
 */

export interface VersionInfo {
  app: 'api';
  release: string;
  build: string;
  environment: string;
  branch: string | null;
  builtAt: string | null;
  display: string;
}

// npm_package_version is only set when the process was started through an npm
// script, so this is right in local dev and falls back to the literal in a
// serverless deploy. That is acceptable because nothing bumps it — `build`
// below is what actually identifies a deploy.
const release = process.env.npm_package_version || '0.0.1';

// Mirrors shortSha in @agam/shared: only a full 40-char SHA is shortened.
function shortSha(sha: string | undefined): string {
  if (!sha) return 'unknown';
  return /^[0-9a-f]{40}$/i.test(sha) ? sha.slice(0, 7) : sha;
}

export function getVersion(): VersionInfo {
  const build = shortSha(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA);
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  const branch = process.env.VERCEL_GIT_COMMIT_REF || null;

  return {
    app: 'api',
    release,
    build,
    environment,
    branch,
    builtAt: process.env.BUILD_TIME || null,
    display: `api ${release} (${build}) · ${environment}`,
  };
}
