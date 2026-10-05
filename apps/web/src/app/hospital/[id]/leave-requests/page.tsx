"use client";

import { useParams } from "next/navigation";
import LeaveRequestsPage from "@/components/leave/LeaveRequestsPage";

export default function LeaveRequestsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <LeaveRequestsPage hospitalId={hospitalId} />;
}
