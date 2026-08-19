// components/DoctorsPage.tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import DoctorTableRow from "@/components/doctors/DoctorTableRow";
import DoctorDetailSidebar from "@/components/doctors/DoctorDetailSidebar";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import NoDataFound from "@/components/NoDataFound";
import FiltersPanel, { DateRange } from "@/components/FiltersPanel";
import Pagination from "@/components/Pagination";
import { DOCTOR_STATUS_OPTIONS, DOCTOR_SORT_OPTIONS, DoctorListFilters } from "@/types/doctorNew";
import {
  Plus,
  Stethoscope,
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  UserCheck,
  UserX,
  X,
  Download,
} from "lucide-react";
import { Doctor } from "@/types/doctorNew";
import { useNewDoctorApi, useUpdateDoctorMembership } from "@/hooks/useNewDoctorApi";
import { apiUrl, fetchWithAuth } from "@/lib/api";
interface DoctorsPageProps {
  userRole: string;
  canEdit: boolean;
  doctors: Doctor[];
  isLoading: boolean;
  refetchDoctors: () => Promise<any>;
  hospitalId: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onFiltersChange?: (filters: DoctorListFilters) => void;
}

const emptyDateRange: DateRange = { from: "", to: "" };

export default function DoctorsPage({
  canEdit,
  doctors = [],
  isLoading,
  refetchDoctors,
  hospitalId,
  pagination,
  onPageChange,
  onFiltersChange,
}: DoctorsPageProps) {
  const { deleteDoctor, isDeleting } = useNewDoctorApi();
  const { mutate: updateDoctorMembership, mutateAsync: updateDoctorMembershipAsync } = useUpdateDoctorMembership(hospitalId);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Doctor | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>(emptyDateRange);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const router = useRouter();

  // Doctors are already filtered, sorted, and paginated by the API based on the
  // current search/status/date-range/sort state below.
  const filteredDoctors = doctors;

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      // Skip the initial mount: the parent already fetches with default filters,
      // so re-sending them here would just trigger a redundant request.
      isFirstRender.current = false;
      return;
    }

    // Debounce so the search box doesn't fire a request on every keystroke.
    const handle = setTimeout(() => {
      onFiltersChange?.({
        search: search || undefined,
        status: filter === "all" ? undefined : filter,
        joinedFrom: dateRange.from || undefined,
        joinedTo: dateRange.to || undefined,
        sortBy: sortBy as DoctorListFilters['sortBy'],
        sortOrder,
      });
      onPageChange?.(1);
    }, 400);

    return () => clearTimeout(handle);
  }, [search, filter, dateRange, sortBy, sortOrder, onFiltersChange, onPageChange]);

  // Selection only makes sense for the pending doctors currently on screen —
  // clear it whenever that set changes so it can't carry across pages/filters.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filteredDoctors]);

  const selectablePendingDoctors = useMemo(
    () => filteredDoctors.filter((d) => d.membershipStatus === 'pending' && d.membershipId),
    [filteredDoctors],
  );
  // Hide the whole selection column when there's nothing to select on this page
  // (e.g. viewing an all-approved list) instead of leaving an empty, awkward gutter.
  const showSelectionColumn = canEdit && selectablePendingDoctors.length > 0;
  const allPendingSelected =
    selectablePendingDoctors.length > 0 &&
    selectablePendingDoctors.every((d) => selectedIds.has(d.membershipId as string));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size > 0 && selectablePendingDoctors.every((d) => prev.has(d.membershipId as string))) {
        return new Set();
      }
      return new Set(selectablePendingDoctors.map((d) => d.membershipId as string));
    });
  }, [selectablePendingDoctors]);

  const toggleSelectOne = useCallback((membershipId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }, []);

  const escapeCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filter !== 'all') params.append('status', filter);
      if (dateRange.from) params.append('joinedFrom', dateRange.from);
      if (dateRange.to) params.append('joinedTo', dateRange.to);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      // Pull every matching doctor, not just the current page.
      params.append('limit', String(Math.max(pagination?.total ?? 0, 1000)));
      params.append('page', '1');

      const response = await fetchWithAuth(`${apiUrl(`/hospitals/${hospitalId}/doctors`)}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch doctors for export');

      const data = await response.json();
      const rows: Doctor[] = data.doctors || [];

      const header = ['Name', 'Email', 'Phone', 'Specialization', 'Status', 'Joined'];
      const csvLines = [header, ...rows.map((d) => [
        d.name,
        d.email,
        d.phone || '',
        d.specialization || '',
        d.membershipStatus || '',
        d.joinedAt ? new Date(d.joinedAt).toISOString() : '',
      ])].map((row) => row.map(escapeCsvCell).join(','));

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `doctors-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      showToast('❌ Failed to export doctors');
    } finally {
      setExporting(false);
    }
  };

  const handleBulkStatusChange = async (status: 'approved' | 'rejected') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkUpdating(true);
    try {
      await Promise.all(ids.map((membershipId) => updateDoctorMembershipAsync({ doctorId: membershipId, updates: { status } })));
      showToast(`✅ ${ids.length} doctor${ids.length > 1 ? 's' : ''} ${status}`);
      setSelectedIds(new Set());
      await refetchDoctors();
    } catch (error) {
      console.error('Bulk status update failed:', error);
      showToast('❌ Failed to update some doctors');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDeleteDoctor = async (id: string) => {
    try {
      await deleteDoctor(id);
      setConfirmDelete(null);
      showToast("🗑️ Doctor deleted successfully");
      await refetchDoctors();
    } catch (error) {
      console.error("Error deleting doctor:", error);
      showToast("❌ Failed to delete doctor");
    }
  };

  const handleUpdateStatus = async (id: string, status: 'pending' | 'approved' | 'rejected') => {
    try {
      await updateDoctorMembership({doctorId: id, updates: { status: status }});
      showToast(`✅ Status updated to '${status}'`);
      await refetchDoctors();
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("❌ Failed to update status");
    }
  };

  const handleEditDoctor = useCallback((doctor: Doctor) => {
    router.push(`/hospital/${hospitalId}/doctors/${doctor.id}/edit`);
  }, [router]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setFilter("all");
    setDateRange(emptyDateRange);
    setSortBy("name");
    setSortOrder("asc");
  }, []);

  const hasActiveFilters = useMemo(() =>
    Boolean(search || filter !== "all" || dateRange.from || dateRange.to || sortBy !== "name" || sortOrder !== "asc"),
    [search, filter, dateRange, sortBy, sortOrder]
  );

  const toggleSort = useCallback((field: 'name' | 'joinedAt') => {
    setSortBy((current) => {
      if (current === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortOrder('asc');
      }
      return field;
    });
  }, []);

  const handleCloseModal = useCallback(() => setActiveDoctor(null), []);
  const handleDelete = useCallback((doctor: Doctor) => {
    setConfirmDelete(doctor);
    setActiveDoctor(null);
  }, []);

  // Show loading state only on initial load
  if (isLoading && doctors.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="sm:px-6 lg:px-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Doctors</h1>
            <p className="text-sm text-slate-500">
              {pagination?.total ?? filteredDoctors.length} doctors found
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctor..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm w-56 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
            />
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-purple-100 text-purple-600' : 'hover:bg-slate-100 text-slate-500'
              }`}
              title="Filter"
              type="button"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => refetchDoctors()}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              title="Refresh"
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export to CSV"
              type="button"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
            </button>
          </div>
          {canEdit && (
            <button
              onClick={() => router.push(`/hospital/${hospitalId}/doctors/add`)}
              className="hidden sm:flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm shadow-purple-200"
              type="button"
            >
              <Plus className="w-4 h-4" /> Add Doctor
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <FiltersPanel
          title="doctors"
          statusOptions={DOCTOR_STATUS_OPTIONS}
          statusFilter={filter}
          setStatusFilter={setFilter}
          onClose={() => setShowFilters(false)}
          onClear={clearAllFilters}
          dateRange={dateRange}
          setDateRange={setDateRange}
          dateRangeLabel="Joined date range"
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          sortOptions={DOCTOR_SORT_OPTIONS}
        />
      )}

      {/* Bulk approve/reject bar */}
      {canEdit && selectedIds.size > 0 && (
        <div className="mt-4 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-purple-700">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusChange('approved')}
              disabled={bulkUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserCheck className="w-4 h-4" /> Approve
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusChange('rejected')}
              disabled={bulkUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserX className="w-4 h-4" /> Reject
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkUpdating}
              className="p-1.5 text-purple-400 hover:text-purple-600 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Doctors Table or No Data Found */}
      {filteredDoctors && filteredDoctors.length > 0 ? (
        <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[860px]">
            <colgroup>
              {showSelectionColumn && <col style={{ width: "40px" }} />}
              <col style={{ width: showSelectionColumn ? "28%" : "30%" }} />
              <col style={{ width: showSelectionColumn ? "24%" : "26%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: showSelectionColumn ? "12%" : "14%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)" }}>
                {showSelectionColumn && (
                  <th scope="col" className="w-10 px-0 py-4 rounded-tl-2xl">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-white/50 text-purple-600 focus:ring-purple-300 cursor-pointer"
                        aria-label="Select all pending doctors"
                      />
                    </div>
                  </th>
                )}
                <th
                  scope="col"
                  className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-white text-left ${
                    showSelectionColumn ? '' : 'rounded-tl-2xl'
                  }`}
                >
                  <button type="button" onClick={() => toggleSort('name')} className="flex items-center gap-1.5">
                    Doctor
                    <ArrowUpDown className="w-3.5 h-3.5 text-purple-200" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white text-left hidden md:table-cell">
                  Contact
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white text-left">
                  Status
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white text-left hidden lg:table-cell">
                  <button type="button" onClick={() => toggleSort('joinedAt')} className="flex items-center gap-1.5">
                    Joined
                    <ArrowUpDown className="w-3.5 h-3.5 text-purple-200" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-white text-right rounded-tr-2xl">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((doctor, index) => (
                <DoctorTableRow
                  key={`${doctor.id}-${index}`}
                  doctor={doctor}
                  index={index}
                  onView={() => setActiveDoctor(doctor)}
                  onEdit={canEdit ? () => handleEditDoctor(doctor) : undefined}
                  onDelete={canEdit ? () => handleDelete(doctor) : undefined}
                  isUpdatingStatus={bulkUpdating && doctor.membershipId ? selectedIds.has(doctor.membershipId) : false}
                  showSelectionColumn={showSelectionColumn}
                  selectable={canEdit && doctor.membershipStatus === 'pending' && !!doctor.membershipId}
                  selected={!!doctor.membershipId && selectedIds.has(doctor.membershipId)}
                  onToggleSelect={doctor.membershipId ? () => toggleSelectOne(doctor.membershipId as string) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <NoDataFound
          type=""
          searchQuery={search}
          hasFilters={hasActiveFilters}
          onClearFilters={clearAllFilters}
        />
      )}

      {/* Pagination */}
      {pagination && onPageChange && filteredDoctors.length > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
          hasNextPage={pagination.hasNextPage}
          hasPreviousPage={pagination.hasPreviousPage}
          total={pagination.total}
          limit={pagination.limit}
          transparent
        />
      )}

      {/* Doctor detail sidebar */}
      <DoctorDetailSidebar
        doctor={activeDoctor}
        onClose={handleCloseModal}
        updateStatus={canEdit ? handleUpdateStatus : undefined}
        onDelete={canEdit ? handleDelete : undefined}
        onEdit={canEdit ? handleEditDoctor : undefined}
        canEdit={canEdit}
      />

      {/* Confirm delete modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          data={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteDoctor(confirmDelete.id)}
          message={`Are you sure you want to delete Dr. ${confirmDelete.name}? This action cannot be undone.`}
          isDeleting={isDeleting}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg animate-fadeIn z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
