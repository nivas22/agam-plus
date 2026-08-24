"use client";

import { Mail, Phone, Pencil, Trash2, Eye } from 'lucide-react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { Patient } from "@/types/patientNew";
import { patientStatusConfig } from "@/lib/patientStatus";
import { paletteFor } from "@/lib/avatarPalette";
import { calculateAge } from "@/utils/dateUtils";

interface PatientTableRowProps {
  patient: Patient;
  index: number;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const NEW_PATIENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const STATUS_STRIPE: Record<string, string> = {
  approved: 'bg-status-open',
  active: 'bg-status-open',
  pending: 'bg-status-warning',
  inactive: 'bg-status-danger',
  archived: 'bg-ink-500',
};

const getInitials = (name?: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function PatientTableRow({
  patient,
  index,
  onView,
  onEdit,
  onDelete,
}: PatientTableRowProps) {
  const status = patientStatusConfig(patient.status);
  const [c1, c2] = paletteFor(patient.name || 'Patient');
  const initials = getInitials(patient.name);

  const joinedRelative = patient.createdAt
    ? `${formatDistanceToNowStrict(new Date(patient.createdAt))} ago`
    : '—';
  const joinedAbsolute = patient.createdAt
    ? format(new Date(patient.createdAt), 'd MMM yyyy')
    : null;
  const isNew = patient.createdAt
    ? Date.now() - new Date(patient.createdAt).getTime() < NEW_PATIENT_WINDOW_MS
    : false;

  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;

  return (
    <tr
      className={`relative transition-colors ${index % 2 === 1 ? 'bg-surface-canvas/60' : 'bg-surface-paper'} border-b border-border last:border-b-0`}
    >
      <td className="w-1 p-0">
        <div className={`w-1 h-full ${STATUS_STRIPE[patient.status] || 'bg-border'}`} />
      </td>

      <td className="px-6 py-4 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onView}
                className="font-semibold text-ink-900 text-sm truncate hover:text-brand-violet hover:underline transition-colors text-left"
              >
                {patient.name}
              </button>
              {isNew && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-brand-violet-soft text-brand-violet px-1.5 py-0.5 rounded-md shrink-0">
                  New
                </span>
              )}
            </div>
            {patient.patientId && (
              <div className="text-xs text-ink-500 truncate">#{patient.patientId}</div>
            )}
          </div>
        </div>
      </td>

      <td className="px-6 py-4 align-middle hidden sm:table-cell text-sm text-ink-700">
        {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase() : '—'}
        {age !== null && <span className="text-ink-500"> · {age} yrs</span>}
      </td>

      <td className="px-6 py-4 align-middle hidden md:table-cell">
        <div className="space-y-0.5 min-w-0">
          {patient.email && (
            <div className="flex items-center gap-1.5 text-sm text-ink-700 min-w-0">
              <Mail className="w-3.5 h-3.5 text-ink-500 shrink-0" />
              <span className="truncate">{patient.email}</span>
            </div>
          )}
          {patient.phone && (
            <div className="flex items-center gap-1.5 text-xs text-ink-500 min-w-0">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="truncate">{patient.phone}</span>
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

      <td className="px-6 py-4 align-middle hidden lg:table-cell text-sm whitespace-nowrap">
        <div className="text-ink-700">{joinedRelative}</div>
        {joinedAbsolute && <div className="text-xs text-ink-500">{joinedAbsolute}</div>}
      </td>

      <td className="px-6 py-4 align-middle">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onView}
            className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
            aria-label={`View ${patient.name}`}
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
              aria-label={`Edit ${patient.name}`}
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
              aria-label={`Delete ${patient.name}`}
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
