"use client";

import { useParams } from "next/navigation";
import EditTeamMemberPage from "@/components/team/EditTeamMemberPage";

export default function TeamMemberEditPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const memberId = params.memberId as string;

  return <EditTeamMemberPage hospitalId={hospitalId} memberId={memberId} />;
}
