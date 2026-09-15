import { describe, expect, it } from 'vitest';
import { formatVersion, shortSha, versionFromVercelEnv } from './version';

describe('shortSha', () => {
  it('abbreviates a full 40-character SHA', () => {
    expect(shortSha('a1b2c3d4e5f60718293a4b5c6d7e8f9012345678')).toBe('a1b2c3d');
  });

  it('leaves a native build number alone even when it is valid hex', () => {
    // "12345678" is hex, but truncating it would report a different build.
    expect(shortSha('12345678')).toBe('12345678');
    expect(shortSha('14')).toBe('14');
  });

  it('reports unknown rather than throwing when the env is missing', () => {
    expect(shortSha(undefined)).toBe('unknown');
    expect(shortSha('')).toBe('unknown');
  });
});

describe('formatVersion', () => {
  it('builds one line that identifies the deploy', () => {
    const v = formatVersion({
      app: 'web',
      release: '0.1.0',
      build: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      environment: 'production',
    });
    expect(v.display).toBe('web 0.1.0 (a1b2c3d) · production');
  });

  it('falls back to development when no environment is given', () => {
    expect(formatVersion({ app: 'api', release: '0.0.1' }).environment).toBe('development');
  });
});

describe('versionFromVercelEnv', () => {
  it('reads the server-side system variables', () => {
    const v = versionFromVercelEnv('web', '0.1.0', {
      VERCEL_GIT_COMMIT_SHA: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'version-2',
    });
    expect(v).toMatchObject({ build: 'a1b2c3d', environment: 'preview', branch: 'version-2' });
  });

  it('falls back to the NEXT_PUBLIC_ copies the browser can see', () => {
    const v = versionFromVercelEnv('www', '0.1.0', {
      NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      NEXT_PUBLIC_VERCEL_ENV: 'production',
    });
    expect(v.build).toBe('a1b2c3d');
    expect(v.environment).toBe('production');
  });

  it('reports unknown when Vercel system variables are not exposed', () => {
    // The signal that "Automatically expose System Environment Variables" is off.
    expect(versionFromVercelEnv('web', '0.1.0', {}).build).toBe('unknown');
  });
});
