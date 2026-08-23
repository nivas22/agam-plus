"use client";

import { useParams } from "next/navigation";
import HospitalHolidaysPage from "@/components/settings/HospitalHolidaysPage";

export default function HospitalHolidaysSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <HospitalHolidaysPage hospitalId={hospitalId} />;
}
