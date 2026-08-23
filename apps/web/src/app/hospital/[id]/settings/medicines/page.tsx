"use client";

import { useParams } from "next/navigation";
import MedicineCatalogPage from "@/components/settings/MedicineCatalogPage";

export default function MedicineSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <MedicineCatalogPage hospitalId={hospitalId} />;
}
