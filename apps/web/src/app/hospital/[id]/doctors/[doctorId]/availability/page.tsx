"use client";

import { useParams } from "next/navigation";
import AddEditDoctor from "@/components/doctors/AddEditDoctor";
import { useAuth } from "@/hooks/useAuth";

// "Manage availability" from a doctor's profile — the Availability section of
// the doctor editor on its own, returning to wherever it was opened from.
export default function DoctorAvailabilityPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const doctorId = params.doctorId as string;
  const { isDoctor } = useAuth();

  return (
    <AddEditDoctor
      isNew={false}
      availabilityOnly
      canEdit
      hospitalId={hospitalId}
      id={doctorId}
      backHref={
        isDoctor
          ? `/hospital/${hospitalId}/profile`
          : `/hospital/${hospitalId}/doctors/${doctorId}`
      }
    />
  );
}
