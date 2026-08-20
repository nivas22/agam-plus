// components/DoctorsPage.tsx
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import DoctorTableRow from "@/components/doctors/DoctorTableRow";
import DoctorDetailSidebar from "@/components/doctors/DoctorDetailSidebar";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import NoDataFound from "@/components/NoDataFound";
import FiltersPanel, { DateRange } from "@/components/FiltersPanel";
import { DOCTOR_STATUS_OPTIONS, DOCTOR_SORT_OPTIONS, DoctorListFilters } from "@/types/doctorNew";
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  UserCheck,
  UserX,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
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
  onLimitChange,
  onFiltersChange,
}: DoctorsPageProps) {
  const { deleteDoctor, isDeleting } = useNewDoctorApi();
  const { mutate: updateDoctorMembership, mutateAsync: updateDoctorMembershipAsync } = useUpdateDoctorMembership(hospitalId);
  // Roster counts are independent of the current search/status filter, so they're
  // fetched separately (limit:1, we only need each query's total).
  const { pagination: allStats } = useNewDoctorApi(hospitalId, { limit: 1 });
  const { pagination: approvedStats } = useNewDoctorApi(hospitalId, { status: 'approved', limit: 1 });
  const { pagination: pendingStats } = useNewDoctorApi(hospitalId, { status: 'pending', limit: 1 });
  const rosterTotal = allStats?.total ?? pagination?.total ?? 0;
  const approvedCount = approvedStats?.total ?? 0;
  const pendingCount = pendingStats?.total ?? 0;
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    );
  }

  return (
    <div className="sm:px-6 lg:px-8 relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Doctors</h1>
          <p className="text-sm text-ink-500 mt-1">Everyone who can be booked, and everyone waiting to be.</p>
        </div>

        {/* Roster card */}
        <div className="bg-surface-paper border border-border rounded-xl px-4 py-3 w-full lg:w-72 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Roster</span>
            <span className="text-sm font-bold text-ink-900">{rosterTotal} total</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-canvas">
            {rosterTotal > 0 && (
              <>
                <div className="bg-status-open" style={{ width: `${(approvedCount / rosterTotal) * 100}%` }} />
                <div className="bg-status-warning" style={{ width: `${(pendingCount / rosterTotal) * 100}%` }} />
              </>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-ink-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-open" /> {approvedCount} approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-warning" /> {pendingCount} awaiting approval
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or registration no."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface-paper text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet"
            />
          </div>
          <div className="flex items-center bg-surface-paper border border-border rounded-xl p-1 gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-surface-canvas'
              }`}
              type="button"
            >
              All {rosterTotal}
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'pending' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-surface-canvas'
              }`}
              type="button"
            >
              Pending {pendingCount}
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'approved' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-surface-canvas'
              }`}
              type="button"
            >
              Approved {approvedCount}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-paper border border-border rounded-xl p-1 gap-1">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-brand-violet-soft text-brand-violet' : 'hover:bg-surface-canvas text-ink-500'
              }`}
              title="More filters"
              type="button"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => refetchDoctors()}
              className="p-2 rounded-lg hover:bg-surface-canvas text-ink-500 transition-colors"
              title="Refresh"
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 border border-border bg-surface-paper hover:bg-surface-canvas text-ink-700 text-sm font-medium px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} /> Export
          </button>
          {canEdit && (
            <button
              onClick={() => router.push(`/hospital/${hospitalId}/doctors/add`)}
              className="flex items-center gap-2 bg-status-open hover:bg-status-open-hover text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
              type="button"
            >
              <Plus className="w-4 h-4" /> Add doctor
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
        <div className="mt-4 flex items-center justify-between bg-brand-violet-soft border border-brand-violet/20 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-brand-violet">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusChange('approved')}
              disabled={bulkUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserCheck className="w-4 h-4" /> Approve
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusChange('rejected')}
              disabled={bulkUpdating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-status-danger hover:bg-status-danger-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserX className="w-4 h-4" /> Reject
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkUpdating}
              className="p-1.5 text-brand-violet hover:text-brand-violet-hover rounded-lg hover:bg-brand-violet-soft transition-colors disabled:opacity-50"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Doctors Table or No Data Found */}
      {filteredDoctors && filteredDoctors.length > 0 ? (
        <div className="mt-4 bg-surface-paper rounded-2xl border border-border shadow-sm shadow-border/50 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[960px]">
            <colgroup>
              <col style={{ width: "4px" }} />
              {showSelectionColumn && <col style={{ width: "40px" }} />}
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className="bg-surface-canvas border-b border-border">
                <th className="p-0" />
                {showSelectionColumn && (
                  <th scope="col" className="w-10 px-0 py-3">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border text-brand-violet focus:ring-brand-violet/30 cursor-pointer"
                        aria-label="Select all pending doctors"
                      />
                    </div>
                  </th>
                )}
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left">
                  <button type="button" onClick={() => toggleSort('name')} className="flex items-center gap-1.5 hover:text-ink-900 transition-colors">
                    Doctor
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden sm:table-cell">
                  Specialty
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden md:table-cell">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden lg:table-cell">
                  Patients
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden lg:table-cell">
                  <button type="button" onClick={() => toggleSort('joinedAt')} className="flex items-center gap-1.5 hover:text-ink-900 transition-colors">
                    Joined
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-right">
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
                  onApprove={canEdit && doctor.membershipStatus === 'pending' ? () => handleUpdateStatus(doctor.id, 'approved') : undefined}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 px-1">
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <span>
              Showing <span className="font-semibold text-ink-900">{(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-semibold text-ink-900">{pagination.total}</span>
            </span>
            {onLimitChange && (
              <label className="flex items-center gap-1.5">
                <span>Rows</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="border border-border rounded-lg px-2 py-1 bg-surface-paper text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-violet/30"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.hasPreviousPage}
              className="p-1.5 rounded-lg border border-border bg-surface-paper text-ink-700 hover:bg-surface-canvas disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
              .map((p, i, arr) => (
                <span key={p} className="flex items-center gap-1.5">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="text-ink-500 px-1">…</span>}
                  <button
                    onClick={() => onPageChange(p)}
                    className={`min-w-[2rem] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                      p === pagination.page
                        ? 'bg-ink-900 text-white'
                        : 'border border-border bg-surface-paper text-ink-700 hover:bg-surface-canvas'
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
              className="p-1.5 rounded-lg border border-border bg-surface-paper text-ink-700 hover:bg-surface-canvas disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
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
        <div className="fixed bottom-5 right-5 bg-trace-background text-white px-4 py-3 rounded-lg shadow-lg animate-fadeIn z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
