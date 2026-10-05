"use client";

import { useParams } from "next/navigation";
import InventoryPage from "@/components/inventory/InventoryPage";

export default function InventoryRoute() {
  const { id: hospitalId } = useParams<{ id: string }>();

  return <>{hospitalId && <InventoryPage hospitalId={hospitalId} />}</>;
}
