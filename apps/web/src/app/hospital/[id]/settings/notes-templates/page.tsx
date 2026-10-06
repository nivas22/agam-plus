"use client";

import { useParams } from "next/navigation";
import NotesTemplatesSettingsPage from "@/components/settings/NotesTemplatesSettingsPage";
import { useAuth } from "@/hooks/useAuth";

export default function NotesTemplatesSettingsRoute() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { isAdmin } = useAuth();

  return (
    <NotesTemplatesSettingsPage hospitalId={hospitalId} isAdmin={isAdmin} />
  );
}
