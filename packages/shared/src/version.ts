/**
 * One version contract for every deployable in the repo.
 *
 * The problem this solves: nobody bumps `version` in package.json, so it
 * cannot tell you what is deployed — apps/api has said 0.0.1 since the first
 * commit. The git commit is the only identifier that actually moves with a
 * deploy, so it is the build number for everything that ships from CI.
 *
 * Pure: it reads no environment and no globals. Each app passes in its own
 * raw values, which keeps this usable from a Next server route, a browser
 * bundle and a React Native app alike.
 */

export type AppName = 'api' | 'web' | 'www' | 'doctor';

export interface VersionInput {
  app: AppName;
  /** Marketing version — package.json `version`, or app.json for the app. */
  release: string;
  /**
   * Full git SHA. On Vercel this is VERCEL_GIT_COMMIT_SHA; in CI,
   * GITHUB_SHA. For the mobile app it is the native build number instead,
   * since a store binary is identified by that, not by a commit.
   */
  build?: string;
  /** production | preview | development. VERCEL_ENV maps straight onto this. */
  environment?: string;
  branch?: string;
  builtAt?: string;
}

export interface VersionInfo {
  app: AppName;
  release: string;
  build: string;
  environment: string;
  branch: string | null;
  builtAt: string | null;
  /** "web 0.1.0 (a1b2c3d) · production" — one line for a bug report. */
  display: string;
}

/**
 * Seven characters is git's own abbreviation length and stays unambiguous.
 *
 * Only a full 40-character SHA is shortened. A looser test would also match a
 * native build number — "12345678" is valid hex — and truncate it to a
 * different, wrong number.
 */
export function shortSha(sha: string | undefined | null): string {
  if (!sha) return 'unknown';
  return /^[0-9a-f]{40}$/i.test(sha) ? sha.slice(0, 7) : sha;
}

export function formatVersion(input: VersionInput): VersionInfo {
  const build = shortSha(input.build);
  const environment = input.environment || 'development';

  return {
    app: input.app,
    release: input.release,
    build,
    environment,
    branch: input.branch || null,
    builtAt: input.builtAt || null,
    display: `${input.app} ${input.release} (${build}) · ${environment}`,
  };
}

/**
 * Reads the Vercel system environment. Both apps/web and apps/www deploy
 * there, and the browser only ever sees the NEXT_PUBLIC_-prefixed copies —
 * hence each lookup falling back to the public name.
 *
 * Requires "Automatically expose System Environment Variables" in the Vercel
 * project settings; without it every field falls back and `build` reads
 * "unknown", which is the signal that the setting is off.
 */
export function versionFromVercelEnv(
  app: AppName,
  release: string,
  env: Record<string, string | undefined>,
): VersionInfo {
  return formatVersion({
    app,
    release,
    build: env.VERCEL_GIT_COMMIT_SHA ?? env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    environment: env.VERCEL_ENV ?? env.NEXT_PUBLIC_VERCEL_ENV,
    branch: env.VERCEL_GIT_COMMIT_REF ?? env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
    builtAt: env.BUILD_TIME ?? env.NEXT_PUBLIC_BUILD_TIME,
  });
}
