"use client";

import { useParams } from "next/navigation";
import TodaysQueueV2Page from "@/components/queue/TodaysQueueV2Page";
import { useAuth } from "@/hooks/useAuth";

// The redesigned queue, its own sidebar entry next to the classic one at
// /queue. Shown once Settings > Features > New queue layout is on (see
// ROUTE_MODULES in lib/hospitalModules.ts).
export default function QueueNewPage() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { getCurrentHospitalRole, user } = useAuth();

  return (
    <>
      {hospitalId && (
        <TodaysQueueV2Page
          userRole={getCurrentHospitalRole()}
          canEdit={true}
          hospitalId={hospitalId}
          userId={user?.id}
        />
      )}
    </>
  );
}
