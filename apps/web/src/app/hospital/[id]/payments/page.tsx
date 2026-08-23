"use client";

import { useParams } from "next/navigation";
import PaymentsPage from "@/components/PaymentsPage";

export default function PaymentsRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();

  return <>{hospitalId && <PaymentsPage hospitalId={hospitalId} />}</>;
}
