"use client";

import { useParams } from "next/navigation";
import RolesPermissionsPage from "@/components/roles/RolesPermissionsPage";

export default function RolesSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <RolesPermissionsPage hospitalId={hospitalId} />;
}
