"use client";

import { useParams } from "next/navigation";
import SecurityPage from "@/components/profile/SecurityPage";

export default function ProfileSecurityPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <SecurityPage hospitalId={hospitalId} />;
}
