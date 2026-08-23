"use client";

import { useParams } from "next/navigation";
import TeamPage from "@/components/team/TeamPage";

export default function TeamSettingsPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <TeamPage hospitalId={hospitalId} />;
}
