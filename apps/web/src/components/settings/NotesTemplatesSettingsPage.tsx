// components/settings/NotesTemplatesSettingsPage.tsx
"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { inputClass } from "@/components/common/EditFormControls";
import {
  useCreateNotesTemplate,
  useNotesTemplates,
  useRemoveNotesTemplate,
  useUpdateNotesTemplate,
} from "@/hooks/useNotesTemplateApi";
import type { NotesTemplate } from "@/types/notesTemplate";

interface NotesTemplatesSettingsPageProps {
  hospitalId: string;
  isAdmin: boolean;
}

interface Draft {
  label: string;
  text: string;
  shared: boolean;
}

export default function NotesTemplatesSettingsPage({
  hospitalId,
  isAdmin,
}: NotesTemplatesSettingsPageProps) {
  const { data, isLoading } = useNotesTemplates(hospitalId);
  const createTemplate = useCreateNotesTemplate(hospitalId);
  const updateTemplate = useUpdateNotesTemplate(hospitalId);
  const removeTemplate = useRemoveNotesTemplate(hospitalId);

  // undefined = form closed, null = adding new, string = editing that id.
  const [editingId, setEditingId] = useState<string | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<Draft>({
    label: "",
    text: "",
    shared: isAdmin,
  });

  const items = data?.items || [];
  const shared = items.filter((t) => t.shared);
  const own = items.filter((t) => !t.shared);
  const saving = createTemplate.isPending || updateTemplate.isPending;

  const openNew = () => {
    setDraft({ label: "", text: "", shared: isAdmin });
    setEditingId(null);
  };

  const openEdit = (template: NotesTemplate) => {
    setDraft({
      label: template.label,
      text: template.text,
      shared: template.shared,
    });
    setEditingId(template.id);
  };

  const save = async () => {
    const label = draft.label.trim();
    const text = draft.text.trim();
    if (!label || !text) return;
    try {
      if (editingId) {
        await updateTemplate.mutateAsync({
          templateId: editingId,
          updates: { label, text },
        });
        toast.success("Template updated");
      } else {
        await createTemplate.mutateAsync({
          label,
          text,
          ...(isAdmin ? { shared: draft.shared } : {}),
        });
        toast.success("Template added");
      }
      setEditingId(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save template",
      );
    }
  };

  const remove = async (template: NotesTemplate) => {
    if (!window.confirm(`Remove "${template.label}"?`)) return;
    try {
      await removeTemplate.mutateAsync(template.id);
      if (editingId === template.id) setEditingId(undefined);
      toast.success("Template removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove template",
      );
    }
  };

  const form = (
    <div className="border border-brand-violet/40 rounded-lg p-3 bg-surface-canvas/40 space-y-2.5">
      <input
        type="text"
        value={draft.label}
        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        placeholder="Button label, e.g. Advised rest"
        maxLength={60}
        className={inputClass}
      />
      <textarea
        value={draft.text}
        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
        placeholder="Text added to the session notes"
        rows={4}
        maxLength={4000}
        className={`${inputClass} resize-y`}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {isAdmin && editingId === null && (
          <label className="flex items-center gap-2 text-xs text-ink-700 mr-auto">
            <input
              type="checkbox"
              checked={draft.shared}
              onChange={(e) =>
                setDraft((d) => ({ ...d, shared: e.target.checked }))
              }
            />
            Share with every doctor in this hospital
          </label>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setEditingId(undefined)}
          disabled={saving}
          className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.label.trim() || !draft.text.trim()}
          className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {editingId ? "Save changes" : "Add template"}
        </button>
      </div>
    </div>
  );

  const renderList = (list: NotesTemplate[], emptyText: string) =>
    list.length === 0 ? (
      <div className="text-sm text-ink-500 py-4 text-center">{emptyText}</div>
    ) : (
      <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
        {list.map((template) =>
          editingId === template.id ? (
            <li key={template.id} className="p-2">
              {form}
            </li>
          ) : (
            <li
              key={template.id}
              className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-canvas"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900">
                  {template.label}
                </div>
                <div className="text-xs text-ink-500 mt-0.5 whitespace-pre-line line-clamp-3">
                  {template.text}
                </div>
              </div>
              {template.canEdit && (
                <span className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(template)}
                    className="rounded-md p-1.5 text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft"
                    aria-label={`Edit ${template.label}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(template)}
                    disabled={removeTemplate.isPending}
                    className="rounded-md p-1.5 text-ink-500 hover:text-status-danger hover:bg-status-danger-soft disabled:opacity-50"
                    aria-label={`Remove ${template.label}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </li>
          ),
        )}
      </ul>
    );

  return (
    <div>
      <div className="flex items-end gap-3 mb-5">
        <div className="flex-1">
          <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
            Notes templates
          </h1>
          <p className="text-sm text-ink-500">
            One-click snippets for session notes on the Today screen.
            {isAdmin
              ? " Shared templates show for every doctor; your own show only for you."
              : " Shared ones come from your hospital admin; add your own below."}
          </p>
        </div>
        {editingId === undefined && (
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap"
          >
            <Plus size={16} />
            New template
          </button>
        )}
      </div>

      {editingId === null && <div className="mb-4">{form}</div>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-ink-500 py-6 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-5">
          <section className="bg-surface-paper border border-border rounded-xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">
              Shared with all doctors
            </h2>
            {renderList(shared, "No shared templates yet.")}
          </section>
          <section className="bg-surface-paper border border-border rounded-xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">
              Your templates
            </h2>
            {renderList(own, "You haven't added any of your own yet.")}
          </section>
        </div>
      )}
    </div>
  );
}
