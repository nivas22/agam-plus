"use client";

import { Mail, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Doctor } from "@/types/doctorNew";
import { doctorStatusConfig } from "@/lib/doctorStatus";
import DoctorAvatar from "./DoctorAvatar";

interface DoctorTableRowProps {
  doctor: Doctor;
  index: number;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isUpdatingStatus?: boolean;
  showSelectionColumn?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const NEW_DOCTOR_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function DoctorTableRow({
  doctor,
  index,
  onView,
  onEdit,
  onDelete,
  isUpdatingStatus = false,
  showSelectionColumn = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: DoctorTableRowProps) {
  const status = doctorStatusConfig(doctor.membershipStatus);
  const joinedLabel = doctor.joinedAt
    ? `${formatDistanceToNowStrict(new Date(doctor.joinedAt))} ago`
    : '—';
  const isNew = doctor.joinedAt
    ? Date.now() - new Date(doctor.joinedAt).getTime() < NEW_DOCTOR_WINDOW_MS
    : false;

  return (
    <tr
      className={`transition-colors ${index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} ${
        isUpdatingStatus ? 'opacity-50' : ''
      } border-b border-slate-100 last:border-b-0`}
    >
      {showSelectionColumn && (
        <td className="w-10 px-0 py-4 align-middle">
          <div className="flex items-center justify-center">
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-300 cursor-pointer"
                aria-label={`Select ${doctor.name}`}
              />
            )}
          </div>
        </td>
      )}

      <td className="px-6 py-4 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <DoctorAvatar name={doctor.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => !isUpdatingStatus && onView()}
                disabled={isUpdatingStatus}
                className="font-semibold text-slate-800 text-sm truncate hover:text-purple-600 hover:underline transition-colors disabled:cursor-not-allowed text-left"
              >
                {doctor.name}
              </button>
              {isNew && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-md shrink-0">
                  New
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 truncate">{doctor.specialization || 'General'}</div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 align-middle hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
          <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="truncate">{doctor.email}</span>
        </div>
      </td>

      <td className="px-6 py-4 align-middle">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </td>

      <td className="px-6 py-4 align-middle hidden lg:table-cell text-sm text-slate-500 whitespace-nowrap">
        {joinedLabel}
      </td>

      <td className="px-6 py-4 align-middle">
        <div className="flex items-center justify-end gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              aria-label={`Edit ${doctor.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
              aria-label={`Delete ${doctor.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
