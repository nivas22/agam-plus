// components/enquiries/EnquiriesPage.tsx
"use client";

import { CheckCircle2, MessageCircle } from "lucide-react";
import { useState } from "react";
import {
  useResolveWhatsappEnquiry,
  useWhatsappEnquiries,
} from "@/hooks/useWhatsappApi";

interface EnquiriesPageProps {
  hospitalId: string;
}

const TABS = [
  { key: "new", label: "New" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

export default function EnquiriesPage({ hospitalId }: EnquiriesPageProps) {
  const [tab, setTab] = useState("new");
  const statusFilter = tab === "all" ? undefined : tab;

  const { data: enquiries, isLoading } = useWhatsappEnquiries(
    statusFilter,
    hospitalId,
  );
  const resolve = useResolveWhatsappEnquiry(hospitalId);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">
          Enquiries
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Questions patients sent to your WhatsApp number.
        </p>
      </div>

      <div className="flex gap-1.5 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              tab === t.key
                ? "bg-brand-violet text-white border-brand-violet"
                : "border-border text-ink-700 hover:bg-surface-canvas"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-500">Loading…</div>
      ) : !enquiries?.length ? (
        <div className="bg-surface-paper border border-border rounded-xl p-8 text-center">
          <div className="w-10 h-10 rounded-lg bg-brand-violet-soft text-brand-violet grid place-items-center mx-auto mb-3">
            <MessageCircle size={20} />
          </div>
          <div className="text-sm font-bold text-ink-900">
            Nothing here yet
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {tab === "new"
              ? "New WhatsApp enquiries will show up here."
              : "No enquiries match this filter."}
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {enquiries.map((enquiry) => (
            <div
              key={enquiry.id}
              className="bg-surface-paper border border-border rounded-xl p-4 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-violet-soft text-brand-violet grid place-items-center flex-none">
                <MessageCircle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-ink-900">
                    {enquiry.patientName || enquiry.fromPhone}
                  </span>
                  <span className="text-xs text-ink-500">
                    {enquiry.fromPhone}
                  </span>
                  <span className="text-xs text-ink-500">
                    · {formatWhen(enquiry.createdAt)}
                  </span>
                  {enquiry.status === "resolved" && (
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-status-open-soft text-status-open">
                      Resolved
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-700 mt-1.5 leading-relaxed break-words">
                  {enquiry.message}
                </p>
              </div>
              {enquiry.status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => resolve.mutate(enquiry.id)}
                  disabled={resolve.isPending}
                  className="flex-none flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
