"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import PatientCard from "@/components/patients/PatientCard";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import NoDataFound from "@/components/NoDataFound";
import FiltersPanel from "@/components/FiltersPanel";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import { PATIENT_STATUS_OPTIONS } from "@/types/patient";
import { Plus, User } from "lucide-react";
import { usePatientApi } from '@/hooks/useNewPatientApi';
import PatientDetailModal from "./PatientDetailModal";
import { Patient } from "@/types/patientNew";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";

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
}: PatientsPageProps) {
  // const { data: doctors = [] } = usePatientDoctors(userRole);
  const { upcomingAppointments = [] } = useHospitalAppointmentsApi(hospitalId, userRole, canEdit, undefined);

  const { 
     deletePatient
    } = usePatientApi(hospitalId, undefined, true);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Patient | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // const [updateAppointmentsMode, setUpdateAppointmentsMode] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const router = useRouter();

  // Apply filters with useMemo
  const filteredPatients = useMemo(() => {
    if (!patients || patients.length === 0) return [];

    let results = [...patients];
    const search = searchTerm.trim().toLowerCase();

    if (search) {
      results = results.filter((p) => {
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
    }

    if (genderFilter !== "all") {
      results = results.filter((p) => p.gender === genderFilter);
    }

    return results;
  }, [
    patients,
    searchTerm,
    doctorFilter,
    genderFilter,
    userRole,
  ]);

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
    setDoctorFilter("all");
    setGenderFilter("all");
  }, []);

  const hasActiveFilters = useMemo(() => 
    Boolean(
      searchTerm ||
      statusFilter !== "all" ||
      doctorFilter !== "all" ||
      genderFilter !== "all"
    ),
    [searchTerm, statusFilter, doctorFilter, genderFilter]
  );

  const handleEditPatient = useCallback((patient: Patient) => {
    if (!canEdit) return;
    router.push(`/hospital/${hospitalId}/patients/${patient.id}/edit`);
  }, [canEdit, router]);

  const handleClose = useCallback(() => setSelectedPatient(null), []);
  
  const handleDelete = useCallback(() => 
    selectedPatient && handleConfirmDelete(selectedPatient),
    [selectedPatient]
  );

  // const handleUpdateAppointments = useCallback(() => 
  //   setUpdateAppointmentsMode(true),
  //   []
  // );

  // Loading state
  if (isLoading && patients.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:px-6 lg:px-8 pb-20 relative">
      {/* Header */}
      <PageHeader
        title="Patients"
        type="patient"
        search={searchTerm}
        setSearch={setSearchTerm}
        dataLength={filteredPatients.length}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        icon={User}
        filter={undefined}
        setFilter={undefined}
        refreshData={refetchPatients}
      />

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

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredPatients.map((patient, index) => (
          <PatientCard
            key={`${patient.id}-${index}`}
            patient={patient}
            index={index}
            onClick={() => setSelectedPatient(patient)}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination && onPageChange && filteredPatients.length > 0 && (
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

      {/* Empty State */}
      {!isLoading && filteredPatients.length === 0 && (
        <NoDataFound
          type="patients"
          searchQuery={searchTerm}
          hasFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

      {/* Floating Add Button - Only for admin */}
      {userRole === "admin" && canEdit && (
        <button
          onClick={() => router.push(`/hospital/${hospitalId}/patients/add`)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl hover:bg-blue-700 transition-all transform hover:scale-110 z-10"
          aria-label="Add new patient"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={handleClose}
          onEdit={canEdit ? handleEditPatient : undefined}
          onDelete={canEdit ? handleDelete : undefined}
          // onUpdateAppointments={canEdit ? handleUpdateAppointments : undefined}
          futureAppointments={upcomingAppointments}
        />
      )}

      {/* Update Appointments Modal */}
      {/* {updateAppointmentsMode && selectedPatient && canEdit && (
        <UpdateAppointmentsModal
          doctors={doctors}
          patient={selectedPatient}
          onCancel={() => setUpdateAppointmentsMode(false)}
        />
      )} */}

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
        <div className="fixed bottom-5 right-5 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg animate-fadeIn z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
