"use client";

import { useParams } from "next/navigation";
import MedicinePacksPage from "@/components/settings/MedicinePacksPage";
import { useAuth } from "@/hooks/useAuth";

export default function MedicinePacksSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isDoctor } = useAuth();

  return (
    <MedicinePacksPage hospitalId={hospitalId} canEdit={!isDoctor} />
  );
}
