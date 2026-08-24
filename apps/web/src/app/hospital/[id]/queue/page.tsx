"use client";

import { useParams } from "next/navigation";
import TodaysQueuePage from "@/components/queue/TodaysQueuePage";
import { useAuth } from "@/hooks/useAuth";

export default function QueuePage() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { getCurrentHospitalRole, user } = useAuth();

  const userRole = getCurrentHospitalRole();
  const userId = user?.id;

  return (
    <>
      {hospitalId && (
        <TodaysQueuePage
          userRole={userRole}
          canEdit={true}
          hospitalId={hospitalId}
          userId={userId}
        />
      )}
    </>
  );
}
