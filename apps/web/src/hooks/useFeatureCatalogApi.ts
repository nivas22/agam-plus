// hooks/useFeatureCatalogApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  FeatureReleaseStatus,
  HospitalModuleKey,
  UpcomingFeature,
} from "@/lib/hospitalModules";
import { hospitalModulesKeys } from "./useHospitalModulesApi";

// Platform-wide release state of every module plus the teaser list —
// Platform Admin > Feature catalog. A module missing from moduleStatus is
// available.
export interface FeatureCatalog {
  moduleStatus: Partial<Record<HospitalModuleKey, FeatureReleaseStatus>>;
  upcoming: UpcomingFeature[];
  updatedAt?: string;
}

async function parseJsonOrThrow(response: Response, fallback: string) {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || error?.message || fallback);
  }
  return response.json();
}

export const featureCatalogKeys = {
  all: ["platform-admin", "feature-catalog"] as const,
};

export const useFeatureCatalog = () =>
  useQuery({
    queryKey: featureCatalogKeys.all,
    queryFn: async (): Promise<FeatureCatalog> =>
      parseJsonOrThrow(
        await fetchWithAuth(apiUrl("/platform-admin/feature-catalog")),
        "Failed to load the feature catalog",
      ),
  });

export const useUpdateFeatureCatalog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      catalog: Pick<FeatureCatalog, "moduleStatus" | "upcoming">,
    ): Promise<FeatureCatalog> =>
      parseJsonOrThrow(
        await fetchWithAuth(apiUrl("/platform-admin/feature-catalog"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(catalog),
        }),
        "Failed to save the feature catalog",
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(featureCatalogKeys.all, data);
      // A platform admin switching into a hospital should see the change.
      queryClient.invalidateQueries({ queryKey: hospitalModulesKeys.all });
    },
  });
};
