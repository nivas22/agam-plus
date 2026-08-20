'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Search,
  Plus,
  Users,
  X,
  Phone
} from 'lucide-react';
import { usePatientApi } from '@/hooks/useNewPatientApi';
import { Patient } from '@/types/patientNew';
import { useHospitalAppointmentsApi } from '@/hooks/useNewAppointmentsApi';
import PatientDetailModal from '@/components/patients/PatientDetailModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface MobilePatientsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  hospitalId: string;
}

export default function MobilePatientsPage({ 
  userRole, 
  canEdit, 
  hospitalId 
}: MobilePatientsPageProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Patient | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { 
    patients = [],
    isLoading,
    deletePatient,
    refetchPatients
  } = usePatientApi(hospitalId, undefined, true);

  const { upcomingAppointments = [] } = useHospitalAppointmentsApi(
    hospitalId, 
    userRole, 
    canEdit, 
    undefined
  );

  // Filter patients based on search
  const filteredPatients = useMemo(() => {
    if (!patients || patients.length === 0) return [];
    
    let results = [...patients];
    const search = searchTerm.trim().toLowerCase();

    if (search) {
      results = results.filter((p) => {
        const name = p.name?.toLowerCase() || '';
        const phone = p.phone?.toString() || '';
        const email = p.email?.toLowerCase() || '';
        const patientId = p.patientId?.toString() || '';
        return (
          name.includes(search) ||
          phone.includes(search) ||
          email.includes(search) ||
          patientId.includes(search)
        );
      });
    }

    return results;
  }, [patients, searchTerm]);

  const handleDeletePatient = async (id: string) => {
    try {
      await deletePatient(id);
      setConfirmDelete(null);
      setSelectedPatient(null);
      showToast('Patient deleted successfully');
      await refetchPatients();
    } catch (err) {
      console.error('Error deleting patient:', err);
      showToast('Failed to delete patient');
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

  const handleEditPatient = useCallback((patient: Patient) => {
    if (!canEdit) return;
    router.push(`/mobile/hospital/${hospitalId}/patients/${patient.id}/edit`);
  }, [canEdit, router, hospitalId]);

  const handleClose = useCallback(() => setSelectedPatient(null), []);
  
  const handleDelete = useCallback(() => 
    selectedPatient && handleConfirmDelete(selectedPatient),
    [selectedPatient]
  );

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Header - White like Profile */}
      <div className="bg-surface-paper border-b border-border sticky top-0 z-10">
        {/* Top Bar */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile`)}
              className="p-2 -ml-2 hover:bg-surface-canvas rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-ink-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-ink-900">Patients</h1>
              <p className="text-xs text-ink-500">
                {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}
              </p>
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-all active:scale-95 ${
                showSearch ? 'bg-brand-violet-soft text-brand-violet' : 'hover:bg-surface-canvas text-ink-700'
              }`}
              aria-label="Search"
            >
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 pb-3 animate-fadeIn">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-surface-canvas border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent placeholder:text-ink-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-full transition-colors"
                  aria-label="Clear search"
                >
                  <X size={16} className="text-ink-500" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24">
        {/* Loading State */}
        {isLoading && patients.length === 0 ? (
          <MobileLoadingSpinner message="Loading patients..." variant="admin" size="md" fullScreen={false} />
        ) : filteredPatients.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-surface-canvas rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-ink-500" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900 mb-2">
              {searchTerm ? 'No patients found' : 'No patients yet'}
            </h3>
            <p className="text-sm text-ink-500 text-center max-w-xs">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Add your first patient to get started'}
            </p>
          </div>
        ) : (
          /* Patient Cards - Elegant Design with Color */
          <div className="space-y-3">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className="w-full bg-surface-paper rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] border border-border/60 hover:border-brand-violet/20 group"
              >
                <div className="flex items-start gap-3.5">
                  {/* Elegant Avatar with Color */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-violet to-brand-violet-hover flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                      <span className="text-white font-bold text-lg">
                        {(() => {
                          const nameParts = patient.name.trim().split(' ');
                          if (nameParts.length > 1) {
                            return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
                          }
                          return patient.name.substring(0, 2).toUpperCase();
                        })()}
                      </span>
                    </div>
                    {/* Status Indicator */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                      patient.status === 'approved' ? 'bg-status-open' : 'bg-status-warning'
                    }`}></div>
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1 min-w-0 text-left">
                    {/* Name and Patient ID */}
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-ink-900 truncate">
                        {patient.name}
                      </h3>
                      {patient.patientId && (
                        <span className="px-2 py-0.5 bg-brand-violet-soft text-brand-violet text-xs font-medium rounded-md border border-brand-violet/20">
                          #{patient.patientId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Phone Call Button */}
                  {patient.phone && (
                    <div className="flex-shrink-0">
                      <a
                        href={`tel:${patient.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-violet-soft hover:bg-brand-violet-soft text-brand-violet transition-colors active:scale-95"
                        aria-label="Call patient"
                      >
                        <Phone size={18} />
                      </a>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button - Purple Style */}
      {userRole === 'admin' && canEdit && (
        <button
          onClick={() => router.push(`/mobile/hospital/${hospitalId}/patients/add`)}
          className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-brand-violet to-brand-violet-hover text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:from-brand-violet-hover hover:to-brand-violet-hover transition-all transform hover:scale-105 active:scale-95 z-20"
          aria-label="Add new patient"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={handleClose}
          onEdit={canEdit ? handleEditPatient : undefined}
          onDelete={canEdit ? handleDelete : undefined}
          futureAppointments={upcomingAppointments}
        />
      )}

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
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-trace-background text-white px-4 py-3 rounded-xl shadow-lg animate-fadeIn z-50 text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
