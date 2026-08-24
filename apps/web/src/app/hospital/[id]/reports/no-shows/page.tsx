"use client";

import { useParams } from "next/navigation";
import NoShowsPage from "@/components/reports/NoShowsPage";

export default function NoShowsRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();

  return <>{hospitalId && <NoShowsPage hospitalId={hospitalId} />}</>;
}
