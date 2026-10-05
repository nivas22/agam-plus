"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import PatientFieldsSettingsPage from "@/components/settings/PatientFieldsSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function PatientFieldsSettingsRoute() {
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
    <PatientFieldsSettingsPage hospitalId={hospitalId} canEdit={isAdmin} />
  );
}
