"use client";

import { useParams } from "next/navigation";
import DoctorRevenuePage from "@/components/reports/DoctorRevenuePage";

export default function DoctorRevenueRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();

  return <>{hospitalId && <DoctorRevenuePage hospitalId={hospitalId} />}</>;
}
