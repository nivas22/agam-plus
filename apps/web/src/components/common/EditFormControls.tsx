'use client';

import React from "react";

export const inputClass =
  "w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface-paper text-sm text-ink-900 placeholder:text-ink-500/60 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet disabled:opacity-50 disabled:cursor-not-allowed";

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-status-open" : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function PillGroup({
  options,
  value,
  onChange,
  onClear,
  disabled,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
            value === opt
              ? "bg-brand-violet border-brand-violet text-white"
              : "bg-surface-paper border-border text-ink-700 hover:border-brand-violet"
          }`}
        >
          {opt}
        </button>
      ))}
      {value && onClear && !disabled && (
        <button type="button" onClick={onClear} className="text-sm text-ink-500 underline hover:text-ink-700">
          Clear
        </button>
      )}
    </div>
  );
}

export function Field({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink-900 mb-1.5">
        {label}
        {required && <span className="text-brand-violet ml-0.5">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-ink-500">optional</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
