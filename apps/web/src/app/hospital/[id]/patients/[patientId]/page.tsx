"use client";

import { useParams } from "next/navigation";
import PatientProfilePage from "@/components/patients/PatientProfilePage";

export default function PatientProfileRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const patientId = params.patientId as string;

  return <PatientProfilePage hospitalId={hospitalId} patientId={patientId} />;
}
