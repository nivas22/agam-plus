"use client";

import { useParams } from "next/navigation";
import PackageSettingsPage from "@/components/settings/PackageSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function PackageSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isAdmin } = useAuth();

  return <PackageSettingsPage hospitalId={hospitalId} canEdit={isAdmin} />;
}
