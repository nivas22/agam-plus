// components/settings/SpecializationsSettingsPage.tsx
"use client";

import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  useHospitalSpecializations,
  useUpdateHospitalSpecializations,
} from "@/hooks/useHospitalSpecializationsApi";
import { inputClass } from "@/components/common/EditFormControls";

interface SpecializationsSettingsPageProps {
  hospitalId: string;
  canEdit: boolean;
}

export default function SpecializationsSettingsPage({
  hospitalId,
  canEdit,
}: SpecializationsSettingsPageProps) {
  const { data, isLoading } = useHospitalSpecializations(hospitalId);
  const updateSpecializations = useUpdateHospitalSpecializations(hospitalId);

  const [list, setList] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (data) setList(data.specializations);
  }, [data]);

  const isDirty =
    JSON.stringify(list) !== JSON.stringify(data?.specializations || []);

  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    if (list.some((s) => s.toLowerCase() === value.toLowerCase())) {
      toast.error("Already in the list");
      return;
    }
    setList((prev) => [...prev, value]);
    setDraft("");
  };

  const removeItem = (value: string) => {
    setList((prev) => prev.filter((s) => s !== value));
  };

  const save = async () => {
    try {
      await updateSpecializations.mutateAsync(list);
      toast.success("Specializations updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    }
  };

  const reset = () => setList(data?.specializations || []);

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Specializations
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        The options offered in each doctor&apos;s specialization dropdown.
        Leave this empty to use the default list.
      </p>

      <div className="bg-surface-paper border border-border rounded-xl p-4">
        {canEdit && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="e.g. Cardiologist"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!draft.trim()}
              className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-500 py-6 justify-center">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="text-sm text-ink-500 py-6 text-center">
            Using the default specialization list.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((item) => (
              <span
                key={item}
                className="flex items-center gap-1.5 bg-surface-canvas border border-border rounded-lg pl-3 pr-2 py-1.5 text-sm text-ink-700"
              >
                {item}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="text-ink-500 hover:text-status-danger"
                    aria-label={`Remove ${item}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {canEdit && isDirty && (
        <div className="mt-4 flex gap-2.5 items-center bg-surface-paper border border-border rounded-lg p-3">
          <span className="text-xs text-ink-500 flex-1">
            You have unsaved changes.
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={updateSpecializations.isPending}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={updateSpecializations.isPending}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {updateSpecializations.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save changes
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>Only hospital admins can edit this list.</span>
        </div>
      )}
    </div>
  );
}
