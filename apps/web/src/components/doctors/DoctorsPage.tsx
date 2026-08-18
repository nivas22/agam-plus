// components/DoctorsPage.tsx
'use client';

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import DoctorCard from "@/components/doctors/DoctorCard";
import DoctorDetailModal from "@/components/doctors/DoctorDetailModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import NoDataFound from "@/components/NoDataFound";
import FiltersPanel from "@/components/FiltersPanel";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import { DOCTOR_STATUS_OPTIONS } from "@/types/doctorNew";
import {
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  StethoscopeIcon
} from "lucide-react";
import { Doctor } from "@/types/doctorNew";
import { useNewDoctorApi, useUpdateDoctorMembership } from "@/hooks/useNewDoctorApi";
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
}

export default function DoctorsPage({ 
  canEdit, 
  doctors = [], 
  isLoading, 
  refetchDoctors,
  hospitalId,
  pagination,
  onPageChange,
}: DoctorsPageProps) {
  const { deleteDoctor, isDeleting } = useNewDoctorApi();
  const { mutate: updateDoctorMembership } = useUpdateDoctorMembership(hospitalId);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Doctor | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const router = useRouter();

  // Filtering logic with useMemo
  const filteredDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) {
      return [];
    }

    return doctors.length > 0 && doctors.filter((doctor) => {
      const searchLower = search.toLowerCase();

      const matchesSearch =
        doctor.name?.toLowerCase().includes(searchLower) ||
        doctor.email?.toLowerCase().includes(searchLower) ||
        doctor.specialization?.toLowerCase().includes(searchLower);

      const matchesStatus =
        filter === "all" || doctor.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [doctors, search, filter]) || [];

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
  }, []);

  const hasActiveFilters = useMemo(() => 
    Boolean(search || filter !== "all"),
    [search, filter]
  );

  const statusBadge = useCallback((status: Doctor['membershipStatus']) => {
    const baseClasses = "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold";
    switch (status) {
      case "approved":
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800 border border-green-200`}>
            <CheckCircle size={12} /> Approved
          </span>
        );
      case "pending":
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`}>
            <Clock size={12} /> Pending
          </span>
        );
      case "rejected":
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800 border border-red-200`}>
            <XCircle size={12} /> Rejected
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`}>
            {status}
          </span>
        );
    }
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:px-6 lg:px-8 pb-20 relative">
      <PageHeader
        title="Doctors"
        type="doctor"
        search={search}
        setSearch={setSearch}
        dataLength={filteredDoctors.length}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        icon={StethoscopeIcon} 
        filter={undefined} 
        setFilter={undefined}
        refreshData={refetchDoctors}
      />

      {/* Filters Panel */}
      {showFilters && (
        <FiltersPanel
          title="doctors"
          statusOptions={DOCTOR_STATUS_OPTIONS}
          statusFilter={filter}
          setStatusFilter={setFilter}
          onClose={() => setShowFilters(false)}
          onClear={clearAllFilters}
        />
      )}

      {/* Doctor Cards or No Data Found */}
      {filteredDoctors && filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDoctors.map((doctor, index) => (
            <DoctorCard
              key={`${doctor.id}-${index}`}
              doctor={doctor}
              onClick={() => setActiveDoctor(doctor)}
              isUpdatingStatus={false} // You'll need to pass this from props if needed
            />
          ))}
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
        />
      )}

      {/* Add doctor button - Only show if user has edit permissions */}
      {canEdit && (
        <button
          onClick={() => router.push(`/hospital/${hospitalId}/doctors/add`)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl hover:bg-blue-700 transition-colors z-10"
          aria-label="Add new doctor"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Doctor modal */}
      {activeDoctor && (
        <DoctorDetailModal
          doctor={activeDoctor}
          onClose={handleCloseModal}
          updateStatus={canEdit ? handleUpdateStatus : undefined}
          onDelete={canEdit ? handleDelete : undefined}
          statusBadge={statusBadge(activeDoctor.membershipStatus)}
          onEdit={canEdit ? handleEditDoctor : undefined}
          canEdit={canEdit}
          isUpdatingStatus={false} // You'll need to pass this from props if needed
        />
      )}

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
