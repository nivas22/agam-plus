"use client";

import { Mail, Phone, Pencil, Trash2, Eye, Check } from 'lucide-react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { Doctor } from "@/types/doctorNew";
import { doctorStatusConfig } from "@/lib/doctorStatus";
import DoctorAvatar from "./DoctorAvatar";

interface DoctorTableRowProps {
  doctor: Doctor;
  index: number;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
  isUpdatingStatus?: boolean;
  showSelectionColumn?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const NEW_DOCTOR_WINDOW_MS = 24 * 60 * 60 * 1000;

const STATUS_STRIPE: Record<string, string> = {
  approved: 'bg-status-open',
  pending: 'bg-status-warning',
  rejected: 'bg-status-danger',
};

const SPECIALTY_DOT_COLORS = ['#2563EB', '#DB2777', '#0D9488', '#7C3AED', '#16A34A', '#EA580C'];
const specialtyDotColor = (specialty: string) => {
  let hash = 0;
  for (let i = 0; i < specialty.length; i++) hash = (hash * 31 + specialty.charCodeAt(i)) | 0;
  return SPECIALTY_DOT_COLORS[Math.abs(hash) % SPECIALTY_DOT_COLORS.length];
};

export default function DoctorTableRow({
  doctor,
  index,
  onView,
  onEdit,
  onDelete,
  onApprove,
  isUpdatingStatus = false,
  showSelectionColumn = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: DoctorTableRowProps) {
  const status = doctorStatusConfig(doctor.membershipStatus);
  const joinedRelative = doctor.joinedAt
    ? `${formatDistanceToNowStrict(new Date(doctor.joinedAt))} ago`
    : '—';
  const joinedAbsolute = doctor.joinedAt
    ? format(new Date(doctor.joinedAt), 'd MMM yyyy')
    : null;
  const isNew = doctor.joinedAt
    ? Date.now() - new Date(doctor.joinedAt).getTime() < NEW_DOCTOR_WINDOW_MS
    : false;

  return (
    <tr
      className={`relative transition-colors ${index % 2 === 1 ? 'bg-surface-canvas/60' : 'bg-surface-paper'} ${
        isUpdatingStatus ? 'opacity-50' : ''
      } border-b border-border last:border-b-0`}
    >
      <td className="w-1 p-0">
        <div className={`w-1 h-full ${STATUS_STRIPE[doctor.membershipStatus] || 'bg-border'}`} />
      </td>
      {showSelectionColumn && (
        <td className="w-10 px-0 py-4 align-middle">
          <div className="flex items-center justify-center">
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
                className="w-4 h-4 rounded border-border text-brand-violet focus:ring-brand-violet/30 cursor-pointer"
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
                className="font-semibold text-ink-900 text-sm truncate hover:text-brand-violet hover:underline transition-colors disabled:cursor-not-allowed text-left"
              >
                {doctor.name}
              </button>
              {isNew && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-brand-violet-soft text-brand-violet px-1.5 py-0.5 rounded-md shrink-0">
                  New
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="px-6 py-4 align-middle hidden sm:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-ink-700 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: specialtyDotColor(doctor.specialization || 'General') }}
          />
          <span className="truncate">{doctor.specialization || 'General'}</span>
        </div>
      </td>

      <td className="px-6 py-4 align-middle hidden md:table-cell">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-ink-700 min-w-0">
            <Mail className="w-3.5 h-3.5 text-ink-500 shrink-0" />
            <span className="truncate">{doctor.email}</span>
          </div>
          {doctor.phone && (
            <div className="flex items-center gap-1.5 text-xs text-ink-500 min-w-0">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="truncate">{doctor.phone}</span>
            </div>
          )}
        </div>
      </td>

      <td className="px-6 py-4 align-middle">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </td>

      <td className="px-6 py-4 align-middle hidden lg:table-cell text-sm text-ink-500 whitespace-nowrap">
        —
      </td>

      <td className="px-6 py-4 align-middle hidden lg:table-cell text-sm whitespace-nowrap">
        <div className="text-ink-700">{joinedRelative}</div>
        {joinedAbsolute && <div className="text-xs text-ink-500">{joinedAbsolute}</div>}
      </td>

      <td className="px-6 py-4 align-middle">
        <div className="flex items-center justify-end gap-1">
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              className="p-2 rounded-lg text-ink-500 hover:text-status-open hover:bg-status-open-soft transition-colors"
              aria-label={`Approve ${doctor.name}`}
              title="Approve"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onView}
            className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
            aria-label={`View ${doctor.name}`}
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
              aria-label={`Edit ${doctor.name}`}
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors"
              aria-label={`Delete ${doctor.name}`}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
