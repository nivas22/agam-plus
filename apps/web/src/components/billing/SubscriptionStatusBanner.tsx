"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface SubscriptionStatusBannerProps {
  hospitalId: string;
  isAdmin: boolean;
}

async function fetchSubscriptionStatus(
  hospitalId: string,
): Promise<{ status: string }> {
  const response = await fetchWithAuth(
    apiUrl(`/hospitals/${hospitalId}/subscription`),
  );
  if (!response.ok) throw new Error("Failed to load subscription status");
  const data = await response.json();
  return { status: data.subscription?.status };
}

export default function SubscriptionStatusBanner({
  hospitalId,
  isAdmin,
}: SubscriptionStatusBannerProps) {
  const router = useRouter();

  const { data } = useQuery({
    queryKey: ["hospital", hospitalId, "subscription-status"],
    queryFn: () => fetchSubscriptionStatus(hospitalId),
    enabled: !!hospitalId,
    staleTime: 60_000,
  });

  const status = data?.status;
  if (status !== "past_due" && status !== "suspended") return null;

  const message =
    status === "suspended"
      ? "This hospital's subscription is suspended. Most actions are blocked until payment is confirmed."
      : "This hospital's subscription payment is due. It will be suspended if not paid soon.";

  return (
    <div className="flex items-center gap-2.5 bg-status-danger-soft border border-status-danger/30 rounded-lg p-3 text-xs text-status-danger mb-4">
      <AlertTriangle size={16} className="flex-none" />
      <span className="flex-1">{message}</span>
      {isAdmin && (
        <button
          type="button"
          onClick={() =>
            router.push(`/hospital/${hospitalId}/settings/billing`)
          }
          className="font-semibold underline shrink-0"
        >
          View billing
        </button>
      )}
    </div>
  );
}
