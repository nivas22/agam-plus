// components/common/ModuleRouteGate.tsx
"use client";

import { Loader2, ToggleRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalModules } from "@/hooks/useHospitalModulesApi";
import {
  describeDisabledModule,
  HOSPITAL_MODULE_BY_KEY,
  moduleForHospitalPath,
} from "@/lib/hospitalModules";

// Stands in for a page whose module is off (Settings > Features), so a
// bookmark or old link lands on an explanation instead of a page full of
// failed requests. Pages that don't belong to a module render untouched.
export default function ModuleRouteGate({
  hospitalId,
  children,
}: {
  hospitalId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const prefix = `/hospital/${hospitalId}`;
  const subPath = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length) || "/"
    : pathname;
  const moduleKey = moduleForHospitalPath(subPath);

  const { data, isLoading } = useHospitalModules(hospitalId);

  if (!moduleKey) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-ink-500 py-16">
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  const state = data?.modules.find((m) => m.key === moduleKey);
  // Fail open if the list couldn't load — the API still enforces access.
  if (!state || state.enabled) return <>{children}</>;

  const info = HOSPITAL_MODULE_BY_KEY[moduleKey];

  return (
    <div className="max-w-md mx-auto text-center py-16 px-4">
      <div className="w-11 h-11 rounded-xl bg-brand-violet-soft text-brand-violet grid place-items-center mx-auto mb-4">
        <ToggleRight size={22} />
      </div>
      <h1 className="font-display tracking-tight text-lg font-bold text-ink-900 mb-1.5">
        {info.label} is off
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        {describeDisabledModule(state)}{" "}
        {state.disabledReason !== "plan" &&
          (isAdmin
            ? "You can turn it back on under Settings > Features."
            : "Ask your hospital admin if you need it.")}
      </p>
      {isAdmin && state.disabledReason !== "plan" && (
        <Link
          href={`${prefix}/settings/features`}
          className="inline-flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          Open Features
        </Link>
      )}
    </div>
  );
}
