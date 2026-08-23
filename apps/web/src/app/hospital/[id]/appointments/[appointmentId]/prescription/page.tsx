"use client";

import { useParams } from "next/navigation";
import PrescriptionWriterPage from "@/components/prescriptions/PrescriptionWriterPage";

export default function PrescriptionRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const appointmentId = params.appointmentId as string;

  return (
    <PrescriptionWriterPage
      hospitalId={hospitalId}
      appointmentId={appointmentId}
    />
  );
}
