"use client";

import { useParams } from "next/navigation";
import SpecializationsSettingsPage from "@/components/settings/SpecializationsSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function SpecializationsSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isAdmin } = useAuth();

  return (
    <SpecializationsSettingsPage hospitalId={hospitalId} canEdit={isAdmin} />
  );
}
