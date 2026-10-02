"use client";

import { useParams } from "next/navigation";
import EnquiriesPage from "@/components/enquiries/EnquiriesPage";

export default function EnquiriesRoute() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <EnquiriesPage hospitalId={hospitalId} />;
}
