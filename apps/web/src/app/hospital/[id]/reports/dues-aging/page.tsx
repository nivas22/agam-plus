"use client";

import { useParams } from "next/navigation";
import DuesAgingPage from "@/components/reports/DuesAgingPage";

export default function DuesAgingRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();

  return <>{hospitalId && <DuesAgingPage hospitalId={hospitalId} />}</>;
}
