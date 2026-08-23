'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { Hospital } from '@/types/auth';
import { Building2, Eye, Globe, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import NoDataFound from '@/components/NoDataFound';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import HospitalDetailSidebar from '@/components/hospitals/HospitalDetailSidebar';

async function fetchHospitals(): Promise<Hospital[]> {
  const response = await fetchWithAuth(apiUrl('/hospitals'));
  if (!response.ok) throw new Error('Failed to load hospitals');
  return response.json();
}

async function deleteHospital(id: string): Promise<void> {
  const response = await fetchWithAuth(apiUrl(`/hospitals/${id}`), { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Failed to delete hospital');
  }
}

export default function PlatformAdminHospitalsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeHospital, setActiveHospital] = useState<Hospital | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Hospital | null>(null);

  const { data: hospitals = [], isLoading: hospitalsLoading } = useQuery({
    queryKey: ['platform-admin', 'hospitals'],
    queryFn: fetchHospitals,
  });

  const filteredHospitals = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return hospitals;
    return hospitals.filter((hospital) =>
      [hospital.name, hospital.address, hospital.email, hospital.phone].some((field) =>
        field?.toLowerCase().includes(query),
      ),
    );
  }, [hospitals, search]);

  const deleteMutation = useMutation({
    mutationFn: (hospital: Hospital) => deleteHospital(hospital.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-admin', 'hospitals'] });
      toast.success('Hospital removed');
      setConfirmDelete(null);
      setActiveHospital(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleEdit = (hospital: Hospital) => {
    setActiveHospital(null);
    router.push(`/platform-admin/hospitals/${hospital.id}/edit`);
  };

  const handleDelete = (hospital: Hospital) => {
    setActiveHospital(null);
    setConfirmDelete(hospital);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display tracking-tight text-2xl font-bold text-ink-900">Hospitals</h1>
          <p className="text-sm text-ink-500">{hospitals.length} {hospitals.length === 1 ? 'hospital' : 'hospitals'} on the platform</p>
        </div>
        <button
          onClick={() => router.push('/platform-admin/hospitals/add')}
          className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-brand-violet hover:bg-brand-violet-hover shadow-sm transition-all"
        >
          <Plus className="mr-2 w-4 h-4" />
          Add Hospital
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, address, email or phone"
            className="pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface-paper text-sm w-80 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet"
          />
        </div>
      </div>

      {hospitalsLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-violet/20 border-t-brand-violet" />
        </div>
      ) : filteredHospitals.length > 0 ? (
        <div className="bg-surface-paper rounded-2xl border border-border shadow-sm shadow-border/50 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[960px]">
            <colgroup>
              <col style={{ width: '4px' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr className="bg-surface-canvas border-b border-border">
                <th className="p-0" />
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left">
                  Hospital
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden md:table-cell">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden sm:table-cell">
                  Website
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden lg:table-cell">
                  Added
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHospitals.map((hospital, index) => {
                const joinedRelative = hospital.createdAt ? `${formatDistanceToNowStrict(new Date(hospital.createdAt))} ago` : '—';
                const joinedAbsolute = hospital.createdAt ? format(new Date(hospital.createdAt), 'd MMM yyyy') : null;

                return (
                  <tr
                    key={hospital.id}
                    className={`relative transition-colors ${index % 2 === 1 ? 'bg-surface-canvas/60' : 'bg-surface-paper'} border-b border-border last:border-b-0`}
                  >
                    <td className="w-1 p-0">
                      <div className="w-1 h-full bg-brand-violet" />
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-violet-soft">
                          <Building2 className="w-4.5 h-4.5 text-brand-violet" />
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setActiveHospital(hospital)}
                            className="font-semibold text-ink-900 text-sm truncate hover:text-brand-violet hover:underline transition-colors text-left block"
                          >
                            {hospital.name}
                          </button>
                          <div className="flex items-center gap-1 text-xs text-ink-500 min-w-0">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{hospital.address}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 align-middle hidden md:table-cell">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-sm text-ink-700 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                          <span className="truncate">{hospital.email || '—'}</span>
                        </div>
                        {hospital.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-ink-500 min-w-0">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span className="font-mono tabular truncate">{hospital.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 align-middle hidden sm:table-cell text-sm text-ink-700">
                      {hospital.website ? (
                        <a
                          href={hospital.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 min-w-0 text-brand-violet hover:underline"
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{hospital.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4 align-middle hidden lg:table-cell text-sm whitespace-nowrap">
                      <div className="text-ink-700">{joinedRelative}</div>
                      {joinedAbsolute && <div className="font-mono tabular text-xs text-ink-500">{joinedAbsolute}</div>}
                    </td>

                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveHospital(hospital)}
                          className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
                          aria-label={`View ${hospital.name}`}
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(hospital)}
                          className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
                          aria-label={`Edit ${hospital.name}`}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(hospital)}
                          className="p-2 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors"
                          aria-label={`Delete ${hospital.name}`}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <NoDataFound type="hospitals" searchQuery={search} hasFilters={!!search} onClearFilters={() => setSearch('')} />
      )}

      <HospitalDetailSidebar
        hospital={activeHospital}
        onClose={() => setActiveHospital(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {confirmDelete && (
        <ConfirmDeleteModal
          data={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete)}
          isDeleting={deleteMutation.isPending}
          title="Remove this hospital?"
          message={`This will permanently remove ${confirmDelete.name} and all hospital memberships tied to it.`}
          confirmText="Remove hospital"
        />
      )}
    </div>
  );
}
