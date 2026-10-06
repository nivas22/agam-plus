'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { ShieldCheck, User as UserIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ROLE_LABELS } from '@/types/permissions';

interface UserHospital {
  hospitalId: string;
  hospitalName: string;
  role?: string;
  status?: string;
  isDoctor: boolean;
}

interface PlatformUser {
  id: string;
  name?: string;
  email: string;
  isPlatformAdmin: boolean;
  lastLogin?: string;
  createdAt?: string;
  hospitals: UserHospital[];
}

const ALL_HOSPITALS = '';
const NO_HOSPITAL = '__none__';

function roleLabel(h: UserHospital) {
  const role = ROLE_LABELS[h.role ?? ''] || h.role || 'Member';
  return h.isDoctor && h.role !== 'doctor' ? `${role} · Doctor` : role;
}

async function fetchUsers(): Promise<PlatformUser[]> {
  const response = await fetchWithAuth(apiUrl('/platform-admin/users'));
  if (!response.ok) throw new Error('Failed to load users');
  return response.json();
}

async function setPlatformAdmin(userId: string, isPlatformAdmin: boolean) {
  const response = await fetchWithAuth(apiUrl(`/platform-admin/users/${userId}/platform-admin`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPlatformAdmin }),
  });
  if (!response.ok) throw new Error('Failed to update user');
  return response.json();
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '—';
  }
}

export default function PlatformAdminUsersPage() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['platform-admin', 'users'],
    queryFn: fetchUsers,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isPlatformAdmin }: { userId: string; isPlatformAdmin: boolean }) =>
      setPlatformAdmin(userId, isPlatformAdmin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admin', 'users'] }),
  });

  const [hospitalFilter, setHospitalFilter] = useState(ALL_HOSPITALS);

  const hospitalOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const user of users) {
      for (const h of user.hospitals ?? []) names.set(h.hospitalId, h.hospitalName);
    }
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const visibleUsers = useMemo(() => {
    if (hospitalFilter === ALL_HOSPITALS) return users;
    if (hospitalFilter === NO_HOSPITAL) return users.filter((u) => !u.hospitals?.length);
    return users.filter((u) => u.hospitals?.some((h) => h.hospitalId === hospitalFilter));
  }, [users, hospitalFilter]);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display tracking-tight text-2xl font-bold text-ink-900">Users</h1>
          <p className="text-sm text-ink-500">
            {hospitalFilter === ALL_HOSPITALS
              ? `${users.length} ${users.length === 1 ? 'user' : 'users'} on the platform`
              : `${visibleUsers.length} of ${users.length} users`}
          </p>
        </div>
        <select
          value={hospitalFilter}
          onChange={(e) => setHospitalFilter(e.target.value)}
          aria-label="Filter by hospital"
          className="sm:w-72 px-3 py-2 rounded-lg border border-border bg-surface-paper text-sm text-ink-900"
        >
          <option value={ALL_HOSPITALS}>All hospitals</option>
          {hospitalOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          <option value={NO_HOSPITAL}>Not in any hospital</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-violet/20 border-t-brand-violet" />
        </div>
      ) : error ? (
        <div className="text-center text-status-danger py-10">Failed to load users</div>
      ) : (
        <div className="bg-surface-paper rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-ink-500 uppercase tracking-wide">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Hospitals</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Platform Admin</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-surface-canvas transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-violet-soft flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 text-brand-violet" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-ink-900 truncate">{user.name || 'Unnamed'}</div>
                          <div className="text-xs text-ink-500 truncate">{user.email}</div>
                        </div>
                        {user.isPlatformAdmin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-violet-soft text-brand-violet flex-shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.hospitals?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.hospitals
                            .filter((h) => hospitalFilter === ALL_HOSPITALS || hospitalFilter === NO_HOSPITAL || h.hospitalId === hospitalFilter)
                            .map((h) => (
                              <span
                                key={h.hospitalId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-surface-canvas text-ink-700 whitespace-nowrap"
                              >
                                <span className="font-semibold text-ink-900">{h.hospitalName}</span>
                                <span>· {roleLabel(h)}</span>
                                {h.status && h.status !== 'approved' && (
                                  <span className="text-status-warning capitalize">· {h.status}</span>
                                )}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-ink-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="font-mono tabular px-4 py-3 text-ink-700">{formatDate(user.lastLogin)}</td>
                    <td className="font-mono tabular px-4 py-3 text-ink-700">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleMutation.mutate({ userId: user.id, isPlatformAdmin: !user.isPlatformAdmin })}
                        disabled={toggleMutation.isPending}
                        role="switch"
                        aria-checked={user.isPlatformAdmin}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                          user.isPlatformAdmin ? 'bg-brand-violet' : 'bg-ink-500/30'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            user.isPlatformAdmin ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleUsers.length === 0 && (
            <p className="text-sm text-ink-500 italic px-4 py-8 text-center">No users match this filter</p>
          )}
        </div>
      )}
    </div>
  );
}
