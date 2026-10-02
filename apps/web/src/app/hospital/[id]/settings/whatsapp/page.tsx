"use client";

import { useParams } from "next/navigation";
import WhatsAppSettingsPage from "@/components/settings/WhatsAppSettingsPage";

export default function WhatsAppSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <WhatsAppSettingsPage hospitalId={hospitalId} />;
}
