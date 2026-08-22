"use client";

import { useParams } from "next/navigation";
import AuditTrailPage from "@/components/audit/AuditTrailPage";

export default function AuditSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <AuditTrailPage hospitalId={hospitalId} />;
}
