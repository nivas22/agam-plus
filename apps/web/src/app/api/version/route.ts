import { NextResponse } from "next/server";
import { getVersion } from "@/lib/version";

// Which build is actually serving this deployment. Kept as a route rather
// than only a UI element so uptime checks and deploy smoke tests can read it.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getVersion(), {
    headers: { "cache-control": "no-store" },
  });
}
