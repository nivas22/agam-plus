'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { ShieldCheck, User as UserIcon } from 'lucide-react';

interface PlatformUser {
  id: string;
  name?: string;
  email: string;
  isPlatformAdmin: boolean;
  lastLogin?: string;
  createdAt?: string;
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

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Users</h1>
        <p className="text-sm text-ink-500">{users.length} {users.length === 1 ? 'user' : 'users'} on the platform</p>
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
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Platform Admin</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
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
                    <td className="px-4 py-3 text-ink-700">{formatDate(user.lastLogin)}</td>
                    <td className="px-4 py-3 text-ink-700">{formatDate(user.createdAt)}</td>
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
        </div>
      )}
    </div>
  );
}
