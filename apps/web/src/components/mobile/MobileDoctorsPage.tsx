'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Search,
  Plus,
  Stethoscope,
  X,
  Phone
} from 'lucide-react';
import { useNewDoctorApi } from '@/hooks/useNewDoctorApi';
import { Doctor } from '@/types/doctorNew';
import DoctorDetailModal from '@/components/doctors/DoctorDetailModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface MobileDoctorsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  hospitalId: string;
}

export default function MobileDoctorsPage({ 
  userRole, 
  canEdit, 
  hospitalId 
}: MobileDoctorsPageProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Doctor | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { 
    doctors = [],
    isLoading,
    deleteDoctor,
    refetchDoctors
  } = useNewDoctorApi(hospitalId, undefined, true);

  // Filter doctors based on search
  const filteredDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return [];
    
    let results = [...doctors];
    const search = searchTerm.trim().toLowerCase();

    if (search) {
      results = results.filter((d) => {
        const name = d.name?.toLowerCase() || '';
        const phone = d.phone?.toString() || '';
        const email = d.email?.toLowerCase() || '';
        const specialization = d.specialization?.toLowerCase() || '';
        const qualification = d.qualification?.toLowerCase() || '';
        return (
          name.includes(search) ||
          phone.includes(search) ||
          email.includes(search) ||
          specialization.includes(search) ||
          qualification.includes(search)
        );
      });
    }

    return results;
  }, [doctors, searchTerm]);

  const handleDeleteDoctor = async (id: string) => {
    try {
      await deleteDoctor(id);
      setConfirmDelete(null);
      setSelectedDoctor(null);
      showToast('Doctor deleted successfully');
      await refetchDoctors();
    } catch (err) {
      console.error('Error deleting doctor:', err);
      showToast('Failed to delete doctor');
    }
  };

  const handleConfirmDelete = (doctor: Doctor) => {
    if (!canEdit) return;
    setConfirmDelete(doctor);
    setSelectedDoctor(null);
  };

  const showToast = useCallback((message: string) => {
    setToast(message);
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEditDoctor = useCallback((doctor: Doctor) => {
    if (!canEdit) return;
    router.push(`/mobile/hospital/${hospitalId}/doctors/${doctor.id}/edit`);
  }, [canEdit, router, hospitalId]);

  const handleClose = useCallback(() => setSelectedDoctor(null), []);
  
  const handleDelete = useCallback(() => 
    selectedDoctor && handleConfirmDelete(selectedDoctor),
    [selectedDoctor]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - White like Profile */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        {/* Top Bar */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile`)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">Doctors</h1>
              <p className="text-xs text-gray-500">
                {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'}
              </p>
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-all active:scale-95 ${
                showSearch ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100 text-gray-700'
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
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, specialization, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  aria-label="Clear search"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-24">
        {/* Loading State */}
        {isLoading && doctors.length === 0 ? (
          <MobileLoadingSpinner message="Loading doctors..." variant="admin" size="md" fullScreen={false} />
        ) : filteredDoctors.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Stethoscope className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No doctors found' : 'No doctors yet'}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Add your first doctor to get started'}
            </p>
          </div>
        ) : (
          /* Doctor Cards - Elegant Design with Color */
          <div className="space-y-3">
            {filteredDoctors.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => setSelectedDoctor(doctor)}
                className="w-full bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.99] border border-gray-200/60 hover:border-indigo-200 group"
              >
                <div className="flex items-start gap-3.5">
                  {/* Elegant Avatar with Color */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                      <span className="text-white font-bold text-lg">
                        {(() => {
                          const nameParts = doctor.name.trim().split(' ');
                          if (nameParts.length > 1) {
                            return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
                          }
                          return doctor.name.substring(0, 2).toUpperCase();
                        })()}
                      </span>
                    </div>
                    {/* Status Indicator */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                      doctor.status === 'active' ? 'bg-emerald-500' : 
                      doctor.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
                    }`}></div>
                  </div>
                  
                  {/* Doctor Info */}
                  <div className="flex-1 min-w-0 text-left">
                    {/* Name */}
                    <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                      Dr. {doctor.name}
                    </h3>
                    
                    {/* Specialization - Prominent with Color */}
                    <div className="flex items-center gap-1.5">
                      <Stethoscope size={13} className="text-indigo-500" />
                      <p className="text-sm font-medium text-indigo-700 truncate">
                        {doctor.specialization}
                      </p>
                    </div>
                  </div>

                  {/* Phone Call Button */}
                  {doctor.phone && (
                    <div className="flex-shrink-0">
                      <a
                        href={`tel:${doctor.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors active:scale-95"
                        aria-label="Call doctor"
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

      {/* Floating Add Button - Indigo Style */}
      {userRole === 'admin' && canEdit && (
        <button
          onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors/add`)}
          className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-indigo-800 transition-all transform hover:scale-105 active:scale-95 z-20"
          aria-label="Add new doctor"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <DoctorDetailModal
          doctor={selectedDoctor}
          onClose={handleClose}
          onEdit={canEdit ? handleEditDoctor : undefined}
          onDelete={canEdit ? handleDelete : undefined}
          canEdit={canEdit}
          statusBadge={
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              selectedDoctor.status === 'active' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : selectedDoctor.status === 'pending'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                selectedDoctor.status === 'active' ? 'bg-emerald-500' : 
                selectedDoctor.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
              }`}></span>
              {selectedDoctor.status === 'active' ? 'Active' : 
               selectedDoctor.status === 'pending' ? 'Pending' : 'Inactive'}
            </span>
          }
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          data={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDeleteDoctor(confirmDelete.id)}
          message={`Are you sure you want to delete Dr. ${confirmDelete.name}? This action cannot be undone.`}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg animate-fadeIn z-50 text-sm font-medium">
          {toast}
        </div>
      )}
    </div>
  );
}
