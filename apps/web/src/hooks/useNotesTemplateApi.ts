// hooks/useNotesTemplateApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreateNotesTemplateData,
  NotesTemplateListResponse,
  UpdateNotesTemplateData,
} from "@/types/notesTemplate";

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      errorData.error || `HTTP error! status: ${response.status}`,
      errorData.details,
    );
  }
  return response.json();
}

const notesTemplateApiFunctions = {
  fetchItems: async (
    hospitalId: string,
  ): Promise<NotesTemplateListResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/notes-templates`),
    );
    return parseJsonOrThrow(response);
  },

  createItem: async (hospitalId: string, data: CreateNotesTemplateData) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/notes-templates`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },

  updateItem: async (
    hospitalId: string,
    templateId: string,
    updates: UpdateNotesTemplateData,
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/notes-templates/${templateId}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      },
    );
    return parseJsonOrThrow(response);
  },

  removeItem: async (hospitalId: string, templateId: string) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/notes-templates/${templateId}`),
      { method: "DELETE" },
    );
    return parseJsonOrThrow(response);
  },
};

export const notesTemplateKeys = {
  all: ["notesTemplates"] as const,
  hospital: (hospitalId: string) =>
    [...notesTemplateKeys.all, "hospital", hospitalId] as const,
};

export const useNotesTemplates = (hospitalId: string, enabled = true) =>
  useQuery({
    queryKey: notesTemplateKeys.hospital(hospitalId),
    queryFn: () => notesTemplateApiFunctions.fetchItems(hospitalId),
    enabled: !!hospitalId && enabled,
    staleTime: 60 * 1000,
  });

export const useCreateNotesTemplate = (hospitalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNotesTemplateData) =>
      notesTemplateApiFunctions.createItem(hospitalId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notesTemplateKeys.hospital(hospitalId),
      }),
  });
};

export const useUpdateNotesTemplate = (hospitalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      updates,
    }: {
      templateId: string;
      updates: UpdateNotesTemplateData;
    }) => notesTemplateApiFunctions.updateItem(hospitalId, templateId, updates),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notesTemplateKeys.hospital(hospitalId),
      }),
  });
};

export const useRemoveNotesTemplate = (hospitalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      notesTemplateApiFunctions.removeItem(hospitalId, templateId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: notesTemplateKeys.hospital(hospitalId),
      }),
  });
};
