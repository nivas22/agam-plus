"use client";

import { useParams } from "next/navigation";
import MedicineCatalogPage from "@/components/settings/MedicineCatalogPage";
import { useAuth } from "@/hooks/useAuth";

export default function MedicineSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isDoctor } = useAuth();

  return (
    <MedicineCatalogPage hospitalId={hospitalId} canEdit={!isDoctor} />
  );
}
