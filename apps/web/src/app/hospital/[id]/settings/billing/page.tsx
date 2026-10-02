"use client";

import { useParams } from "next/navigation";
import BillingSettingsPage from "@/components/billing/BillingSettingsPage";

export default function HospitalBillingSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <BillingSettingsPage hospitalId={hospitalId} />;
}
