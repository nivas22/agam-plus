"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PatientTableRow from "@/components/patients/PatientTableRow";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import NoDataFound from "@/components/NoDataFound";
import FiltersPanel from "@/components/FiltersPanel";
import { PATIENT_STATUS_OPTIONS } from "@/types/patient";
import { Plus, Search, Filter, RefreshCw, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { usePatientApi } from '@/hooks/useNewPatientApi';
import PatientDetailSidebar from "./PatientDetailSidebar";
import { Patient } from "@/types/patientNew";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface PatientsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  patients: Patient[] | [];
  isLoading: boolean;
  hospitalId: string;
  refetchPatients: () => Promise<any>;
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
  onFiltersChange?: (filters: { status?: string; gender?: string }) => void;
}

export default function PatientsPage({
  userRole,
  canEdit,
  patients = [],
  isLoading,
  hospitalId,
  refetchPatients,
  pagination,
  onPageChange,
  onLimitChange,
  onFiltersChange,
}: PatientsPageProps) {
  const { upcomingAppointments = [] } = useHospitalAppointmentsApi(hospitalId, userRole, canEdit, undefined);

  const { deletePatient } = usePatientApi(hospitalId, undefined, true);
  // Roster counts are independent of the current filter, so they're fetched
  // separately (limit:1, we only need each query's total).
  const { pagination: allStats } = usePatientApi(hospitalId, { limit: 1 });
  const { pagination: approvedStats } = usePatientApi(hospitalId, { status: 'approved', limit: 1 });
  const { pagination: pendingStats } = usePatientApi(hospitalId, { status: 'pending', limit: 1 });
  const rosterTotal = allStats?.total ?? pagination?.total ?? 0;
  const approvedCount = approvedStats?.total ?? 0;
  const pendingCount = pendingStats?.total ?? 0;

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Patient | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const router = useRouter();

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      onFiltersChange?.({
        status: statusFilter === "all" ? undefined : statusFilter,
        gender: genderFilter === "all" ? undefined : genderFilter,
      });
      onPageChange?.(1);
    }, 400);
    return () => clearTimeout(handle);
  }, [statusFilter, genderFilter, onFiltersChange, onPageChange]);

  // Search is applied client-side against the current page only — there's no
  // search param on the patients endpoint yet.
  const filteredPatients = useMemo(() => {
    if (!patients || patients.length === 0) return [];
    const search = searchTerm.trim().toLowerCase();
    if (!search) return patients;
    return patients.filter((p) => {
      const name = p.name?.toLowerCase() || "";
      const phone = p.phone?.toString() || "";
      const email = p.email?.toLowerCase() || "";
      const patientId = p.patientId?.toString() || "";
      return (
        name.includes(search) ||
        phone.includes(search) ||
        email.includes(search) ||
        patientId.includes(search)
      );
    });
  }, [patients, searchTerm]);

  const handleDeletePatient = async (id: string) => {
    try {
      await deletePatient(id);
      setConfirmDelete(null);
      setSelectedPatient(null);
      showToast("🗑️ Patient deleted successfully");
      await refetchPatients();
    } catch (err) {
      console.error("Error deleting patient:", err);
      showToast("❌ Failed to delete patient");
    }
  };

  const handleConfirmDelete = (patient: Patient) => {
    if (!canEdit) return;
    setConfirmDelete(patient);
    setSelectedPatient(null);
  };

  const showToast = useCallback((message: string) => {
    setToast(message);
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("all");
    setGenderFilter("all");
  }, []);

  const hasActiveFilters = useMemo(() =>
    Boolean(searchTerm || statusFilter !== "all" || genderFilter !== "all"),
    [searchTerm, statusFilter, genderFilter]
  );

  const handleEditPatient = useCallback((patient: Patient) => {
    if (!canEdit) return;
    router.push(`/hospital/${hospitalId}/patients/${patient.id}/edit`);
  }, [canEdit, router, hospitalId]);

  const handleClose = useCallback(() => setSelectedPatient(null), []);

  const handleDelete = useCallback(() =>
    selectedPatient && handleConfirmDelete(selectedPatient),
    [selectedPatient]
  );

  const escapeCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (genderFilter !== 'all') params.append('gender', genderFilter);
      params.append('limit', String(Math.max(pagination?.total ?? 0, 1000)));
      params.append('page', '1');

      const response = await fetchWithAuth(`${apiUrl(`/hospitals/${hospitalId}/patients`)}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch patients for export');

      const data = await response.json();
      const rows: Patient[] = data.patients || [];

      const header = ['Name', 'Email', 'Phone', 'Gender', 'Status', 'Joined'];
      const csvLines = [header, ...rows.map((p) => [
        p.name,
        p.email,
        p.phone || '',
        p.gender || '',
        p.status || '',
        p.createdAt ? new Date(p.createdAt).toISOString() : '',
      ])].map((row) => row.map(escapeCsvCell).join(','));

      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      showToast('❌ Failed to export patients');
    } finally {
      setExporting(false);
    }
  };

  // Loading state
  if (isLoading && patients.length === 0) {
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
          <h1 className="text-2xl font-bold text-ink-900">Patients</h1>
          <p className="text-sm text-ink-500 mt-1">Everyone in your care, and everyone waiting to join.</p>
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
              <span className="w-1.5 h-1.5 rounded-full bg-status-open" /> {approvedCount} active
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email or phone"
              className="pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface-paper text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-violet/30 focus:border-brand-violet"
            />
          </div>
          <div className="flex items-center bg-surface-paper border border-border rounded-xl p-1 gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-surface-canvas'
              }`}
              type="button"
            >
              All {rosterTotal}
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'pending' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-surface-canvas'
              }`}
              type="button"
            >
              Pending {pendingCount}
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'approved' ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-surface-canvas'
              }`}
              type="button"
            >
              Active {approvedCount}
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
              onClick={() => refetchPatients()}
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
          {userRole === "admin" && canEdit && (
            <button
              onClick={() => router.push(`/hospital/${hospitalId}/patients/add`)}
              className="flex items-center gap-2 bg-status-open hover:bg-status-open-hover text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
              type="button"
            >
              <Plus className="w-4 h-4" /> Add patient
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <FiltersPanel
          title="patients"
          statusOptions={PATIENT_STATUS_OPTIONS}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onClose={() => setShowFilters(false)}
          onClear={clearFilters}
        />
      )}

      {/* Patients Table or No Data Found */}
      {filteredPatients && filteredPatients.length > 0 ? (
        <div className="mt-4 bg-surface-paper rounded-2xl border border-border shadow-sm shadow-border/50 overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[860px]">
            <colgroup>
              <col style={{ width: "4px" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr className="bg-surface-canvas border-b border-border">
                <th className="p-0" />
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left">
                  Patient
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden sm:table-cell">
                  Gender / Age
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden md:table-cell">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-left hidden lg:table-cell">
                  Joined
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient, index) => (
                <PatientTableRow
                  key={`${patient.id}-${index}`}
                  patient={patient}
                  index={index}
                  onView={() => setSelectedPatient(patient)}
                  onEdit={canEdit ? () => handleEditPatient(patient) : undefined}
                  onDelete={canEdit ? () => handleConfirmDelete(patient) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <NoDataFound
          type="patients"
          searchQuery={searchTerm}
          hasFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

      {/* Pagination */}
      {pagination && onPageChange && filteredPatients.length > 0 && (
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

      {/* Patient Detail Sidebar */}
      <PatientDetailSidebar
        patient={selectedPatient}
        onClose={handleClose}
        onEdit={canEdit ? handleEditPatient : undefined}
        onDelete={canEdit ? handleDelete : undefined}
        futureAppointments={upcomingAppointments}
        canEdit={canEdit}
      />

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          data={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeletePatient(confirmDelete.id)}
          message={`Are you sure you want to delete ${confirmDelete.name}? This action cannot be undone.`}
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
