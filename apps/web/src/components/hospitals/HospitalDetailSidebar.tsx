'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Mail, Phone, MapPin, Calendar, Globe, FileText, Pencil, Trash2, Building2, Users, ShieldCheck } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Hospital } from '@/types/auth';
import { apiUrl, fetchWithAuth } from '@/lib/api';

interface HospitalMember {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  joinedAt?: string;
}

interface HospitalDetailSidebarProps {
  hospital: Hospital | null;
  onClose: () => void;
  onEdit?: (hospital: Hospital) => void;
  onDelete?: (hospital: Hospital) => void;
}

async function fetchHospitalMembers(hospitalId: string): Promise<HospitalMember[]> {
  const response = await fetchWithAuth(apiUrl(`/platform-admin/hospitals/${hospitalId}/members`));
  if (!response.ok) throw new Error('Failed to load hospital members');
  return response.json();
}

export default function HospitalDetailSidebar({ hospital, onClose, onEdit, onDelete }: HospitalDetailSidebarProps) {
  const [rendered, setRendered] = useState<Hospital | null>(hospital);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (hospital) {
      setRendered(hospital);
      setClosing(false);
      return;
    }

    setClosing(true);
    const timeout = setTimeout(() => setRendered(null), 300);
    return () => clearTimeout(timeout);
  }, [hospital]);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['platform-admin', 'hospitals', hospital?.id, 'members'],
    queryFn: () => fetchHospitalMembers(hospital?.id as string),
    enabled: !!hospital?.id,
  });

  if (!rendered) return null;
  const h = rendered;
  const joinedLabel = h.createdAt ? `${formatDistanceToNowStrict(new Date(h.createdAt))} ago` : null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-ink-900/40 ${closing ? 'animate-sidebarFadeOut' : 'animate-sidebarFadeIn'}`}
        onClick={onClose}
      />

      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[440px] bg-surface-paper shadow-2xl flex flex-col ${
          closing ? 'animate-sidebarSlideOut' : 'animate-sidebarSlideIn'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-gradient-to-br from-brand-violet-soft to-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-violet-soft">
                <Building2 className="w-5 h-5 text-brand-violet" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-ink-900 truncate">{h.name}</h2>
                <p className="text-sm text-ink-500 truncate">{h.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onEdit && (
                <button
                  onClick={() => onEdit(h)}
                  className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
                  title="Edit hospital"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(h)}
                  className="p-2 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors"
                  title="Delete hospital"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-ink-500 hover:text-ink-700 hover:bg-surface-canvas transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">Contact</h3>
            <div className="space-y-2.5">
              {h.email && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Mail className="w-4 h-4 text-ink-500 shrink-0" />
                  <span className="truncate">{h.email}</span>
                </div>
              )}
              {h.phone && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Phone className="w-4 h-4 text-ink-500 shrink-0" />
                  <span>{h.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-ink-700">
                <MapPin className="w-4 h-4 text-ink-500 shrink-0" />
                <span className="truncate">{h.address}</span>
              </div>
              {h.website && (
                <a
                  href={h.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-brand-violet hover:underline"
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span className="truncate">{h.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              {joinedLabel && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Calendar className="w-4 h-4 text-ink-500 shrink-0" />
                  <span>Added {joinedLabel}</span>
                </div>
              )}
            </div>
          </section>

          {h.description && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Description
              </h3>
              <p className="text-sm text-ink-700 leading-relaxed">{h.description}</p>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Members
            </h3>
            {membersLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-violet/20 border-t-brand-violet" />
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.membershipId} className="flex items-center gap-3 bg-surface-canvas rounded-xl p-3">
                    <div className="w-8 h-8 rounded-full bg-brand-violet-soft flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-4 h-4 text-brand-violet" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900 truncate">{member.name || member.email || 'Unnamed user'}</div>
                      {member.name && member.email && <div className="text-xs text-ink-500 truncate">{member.email}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-violet capitalize">{member.role}</span>
                      <span
                        className={`text-[10px] font-medium capitalize ${
                          member.status === 'approved' ? 'text-status-open' : 'text-status-warning'
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500 italic">No members yet</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
