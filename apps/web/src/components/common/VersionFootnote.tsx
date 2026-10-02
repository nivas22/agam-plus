"use client";

import { getVersion } from "@/lib/version";

/**
 * Build identity, small and out of the way.
 *
 * The environment is only printed when it isn't production — on the live site
 * the word "production" is noise, but on a preview deploy it is the whole
 * point: a tester looking at a bug needs to know which build they are on
 * before reporting it.
 */
export default function VersionFootnote({ className = "" }: { className?: string }) {
  const version = getVersion();
  const isPreview = version.environment !== "production";
  // No commit to show when running outside Vercel — printing "unknown" at
  // every local dev login is noise, so say where we are instead.
  const hasBuild = version.build !== "unknown";

  return (
    <p
      // `display` carries the full string (app, release, build, environment)
      // so a support call can read it off a hover or a copy-paste.
      title={version.display}
      className={`text-[11px] text-center select-all ${
        isPreview ? "text-amber-700" : "text-ink-500"
      } ${className}`}
    >
      v{version.release}
      {hasBuild ? ` · ${version.build}` : ""}
      {isPreview ? ` · ${version.environment}` : ""}
    </p>
  );
}
