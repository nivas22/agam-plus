'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { Building2, Mail, Phone } from 'lucide-react';

interface DemoRequest {
  id: string;
  hospitalName: string;
  contactName: string;
  phone: string;
  email?: string;
  city?: string;
  doctorCount?: number;
  message?: string;
  status: 'new' | 'contacted';
  createdAt?: string;
}

async function fetchDemoRequests(): Promise<DemoRequest[]> {
  const response = await fetchWithAuth(apiUrl('/platform-admin/demo-requests'));
  if (!response.ok) throw new Error('Failed to load demo requests');
  return response.json();
}

async function markContacted(id: string) {
  const response = await fetchWithAuth(apiUrl(`/platform-admin/demo-requests/${id}/contacted`), {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to update demo request');
  return response.json();
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

export default function PlatformAdminDemoRequestsPage() {
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['platform-admin', 'demo-requests'],
    queryFn: fetchDemoRequests,
  });

  const contactedMutation = useMutation({
    mutationFn: (id: string) => markContacted(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admin', 'demo-requests'] }),
  });

  const newCount = requests.filter((r) => r.status === 'new').length;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="font-display tracking-tight text-2xl font-bold text-ink-900">Demo requests</h1>
        <p className="text-sm text-ink-500">
          {requests.length} {requests.length === 1 ? 'request' : 'requests'} from the website
          {newCount > 0 && <span className="text-status-warning font-medium"> · {newCount} awaiting contact</span>}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-violet/20 border-t-brand-violet" />
        </div>
      ) : error ? (
        <div className="text-center text-status-danger py-10">Failed to load demo requests</div>
      ) : requests.length === 0 ? (
        <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-10 text-center text-sm text-ink-500">
          No demo requests yet.
        </div>
      ) : (
        <div className="bg-surface-paper rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Hospital / clinic</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Doctors</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-surface-canvas transition-colors align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-ink-900">
                        <Building2 className="w-4 h-4 text-ink-500 flex-shrink-0" />
                        {req.hospitalName}
                      </div>
                      {req.city && <div className="text-xs text-ink-500 mt-0.5">{req.city}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink-900">{req.contactName}</div>
                      <div className="flex items-center gap-1 text-xs text-ink-500 mt-0.5">
                        <Phone className="w-3 h-3" /> {req.phone}
                      </div>
                      {req.email && (
                        <div className="flex items-center gap-1 text-xs text-ink-500 mt-0.5">
                          <Mail className="w-3 h-3" /> {req.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{req.doctorCount ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-700 max-w-xs">
                      <span className="line-clamp-3">{req.message || '—'}</span>
                    </td>
                    <td className="font-mono tabular px-4 py-3 text-ink-700 whitespace-nowrap">{formatDate(req.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'contacted' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-status-open-soft text-status-open whitespace-nowrap">
                          Contacted
                        </span>
                      ) : (
                        <button
                          onClick={() => contactedMutation.mutate(req.id)}
                          disabled={contactedMutation.isPending}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-violet text-white hover:bg-brand-violet-hover transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Mark contacted
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
