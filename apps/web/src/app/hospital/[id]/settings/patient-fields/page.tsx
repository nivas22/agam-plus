"use client";

import { useParams } from "next/navigation";
import PatientFieldsSettingsPage from "@/components/settings/PatientFieldsSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function PatientFieldsSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isAdmin } = useAuth();

  return (
    <PatientFieldsSettingsPage hospitalId={hospitalId} canEdit={isAdmin} />
  );
}
