"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import DoctorTodayPage from "@/components/queue/DoctorTodayPage";
import { useAuth } from "@/hooks/useAuth";

export default function TodayPage() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { user, isDoctor, navigateToHospitalRoute } = useAuth();

  // This page is a single doctor's own queue — front desk/admin already have
  // the multi-doctor board at /hospital/[id]/queue.
  useEffect(() => {
    if (hospitalId && !isDoctor) {
      navigateToHospitalRoute("dashboard", hospitalId);
    }
  }, [hospitalId, isDoctor, navigateToHospitalRoute]);

  if (!hospitalId || !isDoctor || !user?.id) return null;

  return <DoctorTodayPage hospitalId={hospitalId} doctorId={user.id} />;
}
