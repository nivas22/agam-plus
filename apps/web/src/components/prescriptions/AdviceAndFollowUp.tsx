// components/prescriptions/AdviceAndFollowUp.tsx
"use client";

import { inputClass, PillGroup } from "@/components/common/EditFormControls";
import type { FollowUpOption } from "@/types/prescription";
import { FOLLOW_UP_REVIEW_OPTIONS } from "@/types/prescription";

interface AdviceAndFollowUpProps {
  advice: string;
  onAdviceChange: (value: string) => void;
  followUpOption: FollowUpOption;
  onFollowUpOptionChange: (value: FollowUpOption) => void;
}

export default function AdviceAndFollowUp({
  advice,
  onAdviceChange,
  followUpOption,
  onFollowUpOptionChange,
}: AdviceAndFollowUpProps) {
  return (
    <div className="bg-surface-paper border border-border rounded-xl p-4 space-y-4">
      <div>
        <label className="block text-sm font-semibold text-ink-900 mb-2">
          Advice &amp; follow-up
        </label>
        <textarea
          value={advice}
          onChange={(e) => onAdviceChange(e.target.value)}
          rows={3}
          placeholder="Any general advice for the patient..."
          className={`${inputClass} resize-none`}
        />
      </div>
      <div>
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-sm font-semibold text-ink-900">Review in</span>
          <span className="text-xs text-ink-500">
            — creates a draft appointment for the desk
          </span>
        </div>
        <PillGroup
          options={FOLLOW_UP_REVIEW_OPTIONS.map((o) => o.label)}
          value={
            FOLLOW_UP_REVIEW_OPTIONS.find((o) => o.value === followUpOption)
              ?.label || "None"
          }
          onChange={(label) => {
            const opt = FOLLOW_UP_REVIEW_OPTIONS.find((o) => o.label === label);
            if (opt) onFollowUpOptionChange(opt.value);
          }}
        />
      </div>
    </div>
  );
}
