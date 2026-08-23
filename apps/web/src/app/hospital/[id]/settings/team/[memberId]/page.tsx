"use client";

import { useParams } from "next/navigation";
import TeamMemberProfilePage from "@/components/team/TeamMemberProfilePage";

export default function TeamMemberPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const memberId = params.memberId as string;

  return <TeamMemberProfilePage hospitalId={hospitalId} memberId={memberId} />;
}
