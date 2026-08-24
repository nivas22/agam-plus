"use client";

import { useParams } from "next/navigation";
import ChargeCatalogPage from "@/components/settings/ChargeCatalogPage";

export default function ChargeCatalogSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <ChargeCatalogPage hospitalId={hospitalId} />;
}
