"use client";

import { useMutation } from "@tanstack/react-query";
import { apiUrl, fetchWithAuth } from "@/lib/api";

// Sends the doctor's rough notes; the API adds the visit context (vitals,
// allergies, prescription, last visit) and returns a formatted draft. Nothing
// is saved — the draft goes back into the notes box for the doctor to review.
export const useGenerateSessionNotes = (hospitalId: string) =>
  useMutation({
    mutationFn: async (payload: {
      appointmentId: string;
      draft: string;
    }): Promise<{ notes: string }> => {
      const response = await fetchWithAuth(
        apiUrl(`/hospitals/${hospitalId}/ai-notes/session-notes`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Couldn't format the notes. Please try again.",
        );
      }

      return response.json();
    },
  });
