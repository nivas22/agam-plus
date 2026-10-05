"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import SpecializationsSettingsPage from "@/components/settings/SpecializationsSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function SpecializationsSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const router = useRouter();
  const { isAdmin, isDoctor } = useAuth();

  // Admin setup, not part of a doctor's day — the Settings hub hides it.
  useEffect(() => {
    if (isDoctor) router.replace(`/hospital/${hospitalId}/settings`);
  }, [isDoctor, hospitalId, router]);

  if (isDoctor) return null;

  return (
    <SpecializationsSettingsPage hospitalId={hospitalId} canEdit={isAdmin} />
  );
}
