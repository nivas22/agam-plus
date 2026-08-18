'use client';

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  Search,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Loader2,
  CheckCircle2,
  ChevronRight,
  CalendarDays,
  Repeat,
  CalendarRange
} from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { Doctor } from "@/types/doctorNew";
import { Patient } from "@/types/patientNew";
import { useAuth } from "@/hooks/useAuth";
import { useDoctorSlots } from "@/hooks/useDoctorSlots";
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface MobileCreateAppointmentProps {
  userRole: string;
  hospitalId: string;
}

export default function MobileCreateAppointment({ userRole, hospitalId }: MobileCreateAppointmentProps) {
  const router = useRouter();
  const { data: patientsData = { patients: [] } } = useHospitalPatients(hospitalId, undefined, true);
  const { data: doctorsData = { doctors: [] } } = useHospitalDoctors(hospitalId, undefined, true);
  const { currentHospitalMembership, user } = useAuth();

  const { addAppointment } = useHospitalAppointmentsApi(hospitalId, userRole, false, undefined);

  // State
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [frequency, setFrequency] = useState<"once" | "weekly" | "monthly">("once");
  const [numberOfOccurrences, setNumberOfOccurrences] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  
  // UI State
  const [showDoctorList, setShowDoctorList] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  const isoDate = appointmentDate
    ? DateTime.fromISO(appointmentDate).toISODate() ?? undefined
    : undefined;

  const { data: slotData, isLoading: slotsLoading } = useDoctorSlots(
    hospitalId,
    selectedDoctor?.id ?? undefined,
    isoDate
  );

  const availableSlots = slotData?.availableSlots ?? [];

  // Auto-select doctor if user role is doctor
  useEffect(() => {
    if (currentHospitalMembership?.role === 'doctor' && doctorsData.doctors && doctorsData.doctors.length > 0 && !selectedDoctor) {
      
      console.log('currentHospitalMembership:', currentHospitalMembership);
      console.log('user:', user);
      debugger;
      const currentUserDoctor = doctorsData.doctors.find(
        (doctor) => doctor.userId === currentHospitalMembership?.userId || doctor.id === currentHospitalMembership?.userId
      );
      if (currentUserDoctor) {
        setSelectedDoctor(currentUserDoctor);
      }
    }
  }, [doctorsData.doctors, currentHospitalMembership, selectedDoctor]);

  // Filter doctors
  const filteredDoctors = doctorsData.doctors.filter((d) =>
    d.name?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  // Filter patients
  const filteredPatients = patientsData.patients.filter((p) =>
    p.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.email?.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedDoctor || !selectedPatient || !appointmentDate || !appointmentTime) {
      toast.error("Please fill all required fields");
      return;
    }

    if (frequency === 'weekly' && selectedDays.length === 0) {
      toast.error("Please select at least one day for weekly appointments");
      return;
    }

    setSaving(true);
    try {
      await addAppointment({
        doctorProfileId: selectedDoctor.id,
        patientId: selectedPatient.id,
        startDate: appointmentDate,
        preferredTime: appointmentTime,
        frequency,
        numberOfOccurrences: frequency === 'once' ? 1 : numberOfOccurrences,
        selectedDays: frequency === 'weekly' ? selectedDays : [],
        notes,
      });

      toast.success("Appointment created successfully");
      router.push(`/mobile/hospital/${hospitalId}/appointments`);
    } catch (err) {
      console.error("Error scheduling:", err);
      toast.error("Error scheduling appointment");
    } finally {
      setSaving(false);
    }
  };

  const isValid = selectedDoctor && selectedPatient && appointmentDate && appointmentTime;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - White like Profile and Patients */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments`)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">New Appointment</h1>
              <p className="text-xs text-gray-500">Schedule a patient visit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 pb-32">
        {/* Doctor Selection */}
        {currentHospitalMembership?.role === 'doctor' ? (
          <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              Doctor
            </label>
            {selectedDoctor && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedDoctor.name}</p>
                  <p className="text-sm text-gray-600">{selectedDoctor.specialization}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              Select Doctor *
            </label>
            <button
              onClick={() => setShowDoctorList(true)}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
            >
              {selectedDoctor ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{selectedDoctor.name}</p>
                    <p className="text-sm text-gray-600">{selectedDoctor.specialization}</p>
                  </div>
                </div>
              ) : (
                <span className="text-gray-500">Choose a doctor</span>
              )}
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* Patient Selection */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" />
            Select Patient *
          </label>
          <button
            onClick={() => setShowPatientList(true)}
            className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-green-300 transition-colors"
          >
            {selectedPatient ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{selectedPatient.name}</p>
                  {selectedPatient.email && (
                    <p className="text-sm text-gray-600">{selectedPatient.email}</p>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-gray-500">Choose a patient</span>
            )}
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Date Selection */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            Appointment Date *
          </label>
          <input
            type="date"
            value={appointmentDate}
            onChange={(e) => {
              setAppointmentDate(e.target.value);
              setAppointmentTime(""); // Reset time when date changes
            }}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-300 focus:outline-none"
          />
        </div>

        {/* Time Selection */}
        {appointmentDate && selectedDoctor && (
          <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Preferred Time *
            </label>
            {slotsLoading ? (
              <MobileLoadingSpinner message="Loading slots..." variant="default" size="sm" fullScreen={false} />
            ) : availableSlots.length > 0 ? (
              <>
                <button
                  onClick={() => setShowTimeSlots(true)}
                  className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-300 transition-colors mb-3"
                >
                  {appointmentTime ? (
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      <span className="font-semibold text-gray-900">{appointmentTime}</span>
                    </div>
                  ) : (
                    <span className="text-gray-500">Choose a time slot</span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {availableSlots.length} slots available
                </p>
              </>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800">No available slots for this date</p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Type */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-purple-600" />
            Schedule Type *
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setFrequency('once')}
              className={`relative p-4 rounded-2xl border-2 font-semibold transition-all transform active:scale-95 ${
                frequency === 'once'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-600 shadow-lg scale-105'
                  : 'bg-gradient-to-br from-gray-50 to-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <CalendarDays className={`w-6 h-6 mx-auto mb-2 ${
                frequency === 'once' ? 'text-white' : 'text-blue-500'
              }`} />
              <span className="text-sm block">Once</span>
              {frequency === 'once' && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFrequency('weekly')}
              className={`relative p-4 rounded-2xl border-2 font-semibold transition-all transform active:scale-95 ${
                frequency === 'weekly'
                  ? 'bg-gradient-to-br from-purple-500 to-pink-600 text-white border-purple-600 shadow-lg scale-105'
                  : 'bg-gradient-to-br from-gray-50 to-white text-gray-700 border-gray-200 hover:border-purple-300 hover:shadow-md'
              }`}
            >
              <Repeat className={`w-6 h-6 mx-auto mb-2 ${
                frequency === 'weekly' ? 'text-white' : 'text-purple-500'
              }`} />
              <span className="text-sm block">Weekly</span>
              {frequency === 'weekly' && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFrequency('monthly')}
              className={`relative p-4 rounded-2xl border-2 font-semibold transition-all transform active:scale-95 ${
                frequency === 'monthly'
                  ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white border-orange-600 shadow-lg scale-105'
                  : 'bg-gradient-to-br from-gray-50 to-white text-gray-700 border-gray-200 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <CalendarRange className={`w-6 h-6 mx-auto mb-2 ${
                frequency === 'monthly' ? 'text-white' : 'text-orange-500'
              }`} />
              <span className="text-sm block">Monthly</span>
              {frequency === 'monthly' && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Number of Occurrences - Show for weekly/monthly */}
        {frequency !== 'once' && (
          <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Number of Occurrences *
            </label>
            <input
              type="number"
              min="1"
              max="52"
              value={numberOfOccurrences}
              onChange={(e) => setNumberOfOccurrences(parseInt(e.target.value) || 1)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-blue-300 focus:outline-none"
            />
          </div>
        )}

        {/* Days Selection - Show for weekly */}
        {frequency === 'weekly' && selectedDoctor?.availability && (
          <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Days *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {selectedDoctor.availability.map((avail) => (
                <button
                  key={avail.day}
                  type="button"
                  onClick={() => {
                    setSelectedDays(prev =>
                      prev.includes(avail.day)
                        ? prev.filter(d => d !== avail.day)
                        : [...prev, avail.day]
                    );
                  }}
                  className={`p-3 rounded-xl border-2 font-semibold transition-all ${
                    selectedDays.includes(avail.day)
                      ? 'bg-blue-500 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {avail.day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-300 focus:outline-none resize-none"
            placeholder="Any special instructions..."
          />
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            isValid && !saving
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Create Appointment
            </>
          )}
        </button>
      </div>

      {/* Doctor Selection Modal */}
      {showDoctorList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-3xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">Select Doctor</h3>
                <button
                  onClick={() => {
                    setShowDoctorList(false);
                    setDoctorSearch("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search doctors..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-300 focus:outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {filteredDoctors.map((doctor) => (
                <button
                  key={doctor.id}
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setShowDoctorList(false);
                    setDoctorSearch("");
                    setAppointmentTime(""); // Reset time when doctor changes
                  }}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Stethoscope className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{doctor.name}</p>
                      <p className="text-sm text-gray-600">{doctor.specialization}</p>
                    </div>
                    {selectedDoctor?.id === doctor.id && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Patient Selection Modal */}
      {showPatientList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-3xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">Select Patient</h3>
                <button
                  onClick={() => {
                    setShowPatientList(false);
                    setPatientSearch("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-300 focus:outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setShowPatientList(false);
                    setPatientSearch("");
                  }}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{patient.name}</p>
                      {patient.email && (
                        <p className="text-sm text-gray-600">{patient.email}</p>
                      )}
                    </div>
                    {selectedPatient?.id === patient.id && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time Slots Modal */}
      {showTimeSlots && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-3xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">Select Time</h3>
                <button
                  onClick={() => setShowTimeSlots(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600">
                {availableSlots.length} slots available
              </p>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => {
                      setAppointmentTime(slot);
                      setShowTimeSlots(false);
                    }}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                      appointmentTime === slot
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <Clock className={`w-4 h-4 mx-auto mb-1 ${
                      appointmentTime === slot ? 'text-white' : 'text-indigo-500'
                    }`} />
                    <span className="text-sm">{slot}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
