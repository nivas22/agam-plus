"use client";

import { useParams } from "next/navigation";
import DoctorProfilePage from "@/components/doctors/DoctorProfilePage";

export default function DoctorProfileRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const doctorId = params.doctorId as string;

  return <DoctorProfilePage hospitalId={hospitalId} doctorId={doctorId} />;
}
