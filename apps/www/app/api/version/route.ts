import { NextResponse } from "next/server";
import { versionFromVercelEnv } from "@agam/shared";

export const dynamic = "force-dynamic";

export function GET() {
  const version = versionFromVercelEnv("www", "0.1.0", {
    VERCEL_GIT_COMMIT_SHA: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
  });

  return NextResponse.json(version, { headers: { "cache-control": "no-store" } });
}
