"use client";

import { useParams } from "next/navigation";
import DailyCollectionPage from "@/components/reports/DailyCollectionPage";

export default function ReportsRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();

  return <>{hospitalId && <DailyCollectionPage hospitalId={hospitalId} />}</>;
}
