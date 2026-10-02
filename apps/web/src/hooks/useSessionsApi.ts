// hooks/useSessionsApi.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiUrl, fetchWithAuth } from "@/lib/api";

export interface UserSession {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

// Read-only session list, shared by SecurityPage's full manager and the
// compact "Where you're signed in" card on the profile page.
export const useSessions = (enabled: boolean) => {
  return useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: async (): Promise<UserSession[]> => {
      const response = await fetchWithAuth(apiUrl("/auth/sessions"));
      if (!response.ok) return [];
      const data = await response.json();
      return data.sessions || [];
    },
    enabled,
    staleTime: 30 * 1000,
  });
};
