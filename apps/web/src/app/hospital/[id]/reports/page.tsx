"use client";

import { useParams } from "next/navigation";
import DailyCollectionPage from "@/components/reports/DailyCollectionPage";
import DoctorRevenuePage from "@/components/reports/DoctorRevenuePage";
import { useAuth } from "@/hooks/useAuth";

export default function ReportsRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { isDoctor } = useAuth();

  if (!hospitalId) return null;

  // Daily collection is hospital-wide cash/AR — a doctor lands on their own
  // revenue report instead, same as ReportsLayout only listing that for them.
  return isDoctor ? (
    <DoctorRevenuePage hospitalId={hospitalId} />
  ) : (
    <DailyCollectionPage hospitalId={hospitalId} />
  );
}
