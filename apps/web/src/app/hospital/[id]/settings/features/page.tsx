"use client";

import { useParams } from "next/navigation";
import FeaturesSettingsPage from "@/components/settings/FeaturesSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function FeaturesSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isAdmin } = useAuth();

  return <FeaturesSettingsPage hospitalId={hospitalId} canEdit={isAdmin} />;
}
