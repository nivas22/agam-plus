"use client";

import { ChangeEvent } from "react";
import { Lock, User, Edit2 } from "lucide-react";

export interface PersonalInfoData {
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  maritalStatus?: string;
}

interface PersonalInfoSectionProps {
  title?: string;
  readOnly?: boolean;
  data: PersonalInfoData;
  onInputChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onSelectChange?: (field: keyof PersonalInfoData, value: string) => void;
  genders?: string[];
  maritalStatuses?: string[];
  onEdit?: () => void;
}

export default function PersonalInfoSection({
  title = "Personal Information",
  readOnly = false,
  data,
  onInputChange,
  onSelectChange,
  genders = [],
  maritalStatuses = [],
  onEdit,
}: PersonalInfoSectionProps) {
  if (readOnly) {
    return (
      <div className="group relative bg-surface-paper rounded-2xl sm:rounded-3xl shadow-lg border border-border overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-violet/5 to-brand-violet/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">
          <div className="bg-gradient-to-r from-brand-violet to-brand-violet px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                  <User className="text-white" size={16} />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white">{title}</h2>
              </div>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 border border-white/30"
                >
                  <Edit2 size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-brand-violet mb-1">
                  <User size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Full Name</span>
                </div>
                <div className="text-base font-semibold text-ink-900">
                  {data.name || <span className="text-ink-500 italic">Not set</span>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-brand-violet mb-1">
                  <Lock size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Email Address</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="text-sm sm:text-base font-semibold text-ink-900 truncate break-all">
                    {data.email}
                  </div>
                  <span className="px-2.5 py-1 bg-brand-violet-soft border border-brand-violet/20 text-brand-violet text-xs rounded-lg font-semibold flex-shrink-0 w-fit">Protected</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-brand-violet mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Phone Number</span>
                </div>
                <div className="text-base font-semibold text-ink-900">
                  {data.phone || <span className="text-ink-500 italic">Not set</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <User className="w-6 h-6 text-brand-violet" /> Personal Info
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name *</label>
          <input
            name="name"
            value={data.name || ""}
            onChange={onInputChange}
            placeholder="Dr. John Smith"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            name="email"
            value={data.email || ""}
            onChange={onInputChange}
            placeholder="doctor@example.com"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            name="phone"
            value={data.phone || ""}
            onChange={onInputChange}
            placeholder="+1 555 123 4567"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        {genders.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Gender</label>
            <div className="flex gap-2">
              {genders.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onSelectChange?.("gender", g)}
                  className={`px-3 py-1 rounded-lg border ${data.gender === g ? "bg-brand-violet text-white" : "bg-surface-canvas"}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
        {maritalStatuses.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Marital Status</label>
            <div className="flex gap-2">
              {maritalStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelectChange?.("maritalStatus", s)}
                  className={`px-3 py-1 rounded-lg border ${data.maritalStatus === s ? "bg-brand-violet text-white" : "bg-surface-canvas"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
