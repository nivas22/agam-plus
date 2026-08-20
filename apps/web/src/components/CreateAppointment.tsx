// components/CreateAppointment.tsx
'use client';

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  ChevronDown,
  Search,
  Calendar,
  Clock,
  User,
  Stethoscope,
  CalendarCheck,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { DateTime } from "luxon";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { Doctor } from "@/types/doctorNew";
import { Patient } from "@/types/patientNew";
import { useAuth } from "@/hooks/useAuth";
import { useDoctorSlots } from "@/hooks/useDoctorSlots";

interface CreateAppointmentProps {
  canEdit: boolean;
  userRole: string;
  hospitalId: string;
}

export default function CreateAppointment({userRole, hospitalId}: CreateAppointmentProps) {
  const { data: patientsData = { patients: []}, isLoading: patientsLoading, } = useHospitalPatients(hospitalId, undefined, true);
  const { data: doctorsData = { doctors : []}, isLoading: doctorsLoading } = useHospitalDoctors(hospitalId, undefined, true);
  const { navigateToHospitalRoute, currentHospitalMembership } = useAuth();

  const {
      addAppointment,
    } = useHospitalAppointmentsApi(
      hospitalId,
      userRole,
      false,
      undefined,
    );

  // State
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [frequency, setFrequency] = useState<"once" | "weekly" | "monthly">("once");
  const [numberOfOccurrences, setNumberOfOccurrences] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [showDoctorList, setShowDoctorList] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  // const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const isoDate = appointmentDate
  ? DateTime.fromISO(appointmentDate).toISODate() ?? undefined
  : undefined;

  const { data: slotData, isLoading: slotsLoading } = useDoctorSlots(
    hospitalId,
    selectedDoctor?.id ?? undefined,
    isoDate
  );

  const availableSlots = slotData?.availableSlots ?? [];

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDoctorList && !(event.target as Element).closest(".doctor-dropdown")) {
        setShowDoctorList(false);
      }
      if (showPatientList && !(event.target as Element).closest(".patient-dropdown")) {
        setShowPatientList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDoctorList, showPatientList]);

  // Filter doctors
  useEffect(() => {
    if (!doctorsData.doctors) return;
    if (!doctorSearch) {
      setFilteredDoctors(doctorsData.doctors);
      return;
    }
    const q = doctorSearch.toLowerCase();
    setFilteredDoctors(
      doctorsData.doctors.filter((d) =>
        d.name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q)
      )
    );
  }, [doctorSearch, doctorsData, doctorsLoading]);

  // Filter patients
  useEffect(() => {
    if (!patientsData.patients) return;
    const { patients } = patientsData;

    if (!patientSearch) {
      setFilteredPatients(patients);
      return;
    }
    const q = patientSearch.toLowerCase();
    setFilteredPatients(
      patients.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      )
    );
  }, [patientSearch, patientsData.patients, patientsLoading]);

  // Auto-select doctor if user role is doctor
  useEffect(() => {
    if (currentHospitalMembership?.role === 'doctor' && doctorsData.doctors && doctorsData.doctors.length > 0 && !selectedDoctor) {
      // Find the doctor profile that matches the current user
      const currentUserDoctor = doctorsData.doctors.find(
        (doctor) => doctor.profileId === currentHospitalMembership?.userId || doctor.id === currentHospitalMembership?.userId
      );
      if (currentUserDoctor) {
        setSelectedDoctor(currentUserDoctor);
      }
    }
  }, [doctorsData.doctors, currentHospitalMembership, selectedDoctor]);

  // Extract available days from doctor's schedule
  useEffect(() => {
    if (selectedDoctor?.availability) {
      const days = selectedDoctor.availability.map(a => a.day);
      setAvailableDays(days);
      // Auto-select all available days for weekly recurrence
      setSelectedDays(days);
    } else {
      setAvailableDays([]);
      setSelectedDays([]);
    }
  }, [selectedDoctor]);

  // Update loading state based on slots loading
  useEffect(() => {
    setLoading(slotsLoading);
  }, [slotsLoading]);

  // Find next available slot
  // const findNextAvailableSlot = async (doctor: Doctor, date: string, preferredTime: string) => {
  //   const currentDate = new Date(date);
  //   let attempts = 0;
  //   const maxAttempts = 30;
    
  //   while (attempts < maxAttempts) {
  //     const slots = await getAvailableSlots(doctor, currentDate.toISOString().split('T')[0]);
      
  //     if (slots.length > 0) {
  //       if (preferredTime && slots.includes(preferredTime)) {
  //         return {
  //           date: currentDate.toISOString().split('T')[0],
  //           time: preferredTime
  //         };
  //       }
        
  //       return {
  //         date: currentDate.toISOString().split('T')[0],
  //         time: slots[0]
  //       };
  //     }
      
  //     currentDate.setDate(currentDate.getDate() + 1);
  //     attempts++;
  //   }
    
  //   return null;
  // };

  // Helper to create appointment object
  // const makeAppointmentObject = (dateObj: Date, timeStr: string) => ({
  //   doctorProfileId: selectedDoctor!.id,
  //   doctorName: selectedDoctor!.name,
  //   doctorSpecialization: selectedDoctor!.specialization,
  //   patientId: selectedPatient!.id,
  //   patientName: selectedPatient!.name,
  //   date: dateObj.toISOString().split("T")[0],
  //   time: timeStr,
  //   frequency,
  //   notes,
  //   hospitalId,
  //   status: "scheduled" as const
  // });

  // Generate appointments according to frequency
  // const generateAppointments = async () => {
  //   if (!selectedDoctor || !selectedPatient || !appointmentDate || !appointmentTime) {
  //     return [];
  //   }

  //   const appointments = [];
  //   const startDate = new Date(appointmentDate);
  //   let count = 0;
  //   const maxOccurrences = frequency === "once" ? 1 : Math.max(1, numberOfOccurrences);
  //   let attempts = 0;
  //   const SAFETY_LIMIT = 1000;

  //   if (frequency === "once") {
  //     const slot = await findNextAvailableSlot(selectedDoctor, appointmentDate, appointmentTime);
  //     if (slot) {
  //       appointments.push(makeAppointmentObject(new Date(slot.date), slot.time));
  //     }
  //     return appointments;
  //   }

  //   if (frequency === "weekly") {
  //     const cursor = new Date(startDate);
  //     while (count < maxOccurrences && attempts < SAFETY_LIMIT) {
  //       const dayName = cursor.toLocaleDateString("en-US", { weekday: "long" });
  //       if (selectedDays.includes(dayName)) {
  //         const slot = await findNextAvailableSlot(selectedDoctor, cursor.toISOString().split('T')[0], appointmentTime);
  //         if (slot) {
  //           appointments.push(makeAppointmentObject(new Date(slot.date), slot.time));
  //           count++;
  //         }
  //       }
  //       cursor.setDate(cursor.getDate() + 1);
  //       attempts++;
  //     }
  //   }

  //   if (frequency === "monthly") {
  //     const cursor = new Date(startDate);
  //     while (count < maxOccurrences && attempts < SAFETY_LIMIT) {
  //       const slot = await findNextAvailableSlot(selectedDoctor, cursor.toISOString().split('T')[0], appointmentTime);
  //       if (slot) {
  //         appointments.push(makeAppointmentObject(new Date(slot.date), slot.time));
  //         count++;
  //       }
  //       cursor.setMonth(cursor.getMonth() + 1);
  //       attempts++;
  //     }
  //   }

  //   if (attempts >= SAFETY_LIMIT) {
  //     console.warn("Reached attempts safety limit while generating recurring appointments.");
  //   }

  //   return appointments;
  // };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDoctor || !selectedPatient || !appointmentDate || !appointmentTime) {
      toast.error("Please fill all required fields");
      return;
    }

    if (frequency === "weekly" && selectedDays.length === 0) {
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

      // if (!appointmentsToSave.length) {
      //   toast.error("No available slots were found for the selected recurrence/settings.");
      //   setSaving(false);
      //   return;
      // }

      // for (let app of appointmentsToSave) {
      //   await addAppointment(app);
      // }

      toast.success(`Appointment created successfully`);
      navigateToHospitalRoute("appointments", hospitalId);
    } catch (err) {
      console.error("Error scheduling:", err);
      toast.error("Error scheduling appointments. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle day selection for weekly appointments
  const toggleDaySelection = (day: string) => {
    setSelectedDays((prev) => 
      prev.includes(day) 
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  const calculateEndDate = () => {
    if (!appointmentDate || frequency === "once") return "";
    const start = new Date(appointmentDate);
    const end = new Date(start);
    
    if (frequency === "weekly") {
      // Estimate end date based on number of occurrences and selected days
      let occurrences = 0;
      const current = new Date(start);
      const maxDays = 365; // Safety limit
      let daysPassed = 0;
      
      while (occurrences < numberOfOccurrences && daysPassed < maxDays) {
        const dayName = current.toLocaleDateString("en-US", { weekday: "long" });
        if (selectedDays.includes(dayName)) {
          occurrences++;
          if (occurrences === numberOfOccurrences) {
            end.setTime(current.getTime());
          }
        }
        current.setDate(current.getDate() + 1);
        daysPassed++;
      }
    } else if (frequency === "monthly") {
      end.setMonth(start.getMonth() + (numberOfOccurrences - 1));
    }
    
    return end.toISOString().split("T")[0];
  };

  // Validation for submit button
  const isValid =
    selectedDoctor &&
    selectedPatient &&
    appointmentDate &&
    appointmentTime &&
    (frequency === "once" ||
     (frequency === "weekly" && selectedDays.length > 0) ||
     (frequency === "monthly" && numberOfOccurrences >= 1));

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-violet-soft flex justify-center items-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand-violet animate-spin mx-auto mb-4" />
          <p className="text-ink-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-violet-soft md:bg-brand-violet-soft">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-10">
        {/* Mobile Header */}
        <div className="md:hidden mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-brand-violet to-brand-violet rounded-xl shadow-md">
              <CalendarCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900">
                New Appointment
              </h1>
              <p className="text-ink-700 text-xs">
                Schedule a patient visit
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-violet to-brand-violet rounded-2xl blur-lg opacity-30"></div>
                <div className="relative p-4 bg-gradient-to-br from-brand-violet to-brand-violet rounded-2xl shadow-lg">
                  <CalendarCheck className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-ink-900 mb-1">
                  Schedule New Appointment
                </h1>
                <p className="text-ink-700 text-sm md:text-base">
                  Create a new appointment for a patient
                </p>
              </div>
            </div>
            <button 
              onClick={() => navigateToHospitalRoute("appointments", hospitalId)} 
              className="flex items-center gap-2 px-4 py-2 text-ink-700 hover:text-ink-900 hover:bg-white/50 rounded-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
          </div>
        </div>

        {/* Main Form Card */}
        <form onSubmit={handleSubmit} className="bg-surface-paper rounded-xl md:rounded-2xl shadow-md md:shadow-xl border border-border md:border-border/50 overflow-hidden md:bg-white/80 md:backdrop-blur-sm">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-brand-violet/5 via-brand-violet/5 to-brand-violet/5 border-b border-border/50 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-gradient-to-b from-brand-violet to-brand-violet rounded-full"></div>
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Appointment Details</h2>
                <p className="text-xs text-ink-700">Fill in the information below</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* Left Column - Basic Information */}
              <div className="space-y-6">
                {/* Doctor Selection - Only show for admin, hide for doctors */}
                {currentHospitalMembership?.role === 'doctor' ? (
                  // Display selected doctor info for doctor role (read-only)
                  <div className="doctor-info">
                    <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                      <div className="p-1.5 bg-brand-violet-soft rounded-lg">
                        <Stethoscope className="w-4 h-4 text-brand-violet" />
                      </div>
                      Doctor
                    </label>
                    <div className="p-4 border-2 border-brand-violet rounded-xl bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft">
                      {selectedDoctor ? (
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-brand-violet to-brand-violet rounded-xl flex items-center justify-center shadow-md">
                              <Stethoscope className="w-5 h-5 text-white" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-status-open rounded-full border-2 border-white"></div>
                          </div>
                          <div>
                            <div className="font-semibold text-ink-900">{selectedDoctor.name}</div>
                            <div className="text-sm text-ink-700 flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 bg-brand-violet rounded-full"></span>
                              {selectedDoctor.specialization}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-ink-500">
                          <div className="w-10 h-10 bg-surface-canvas rounded-xl flex items-center justify-center">
                            <Stethoscope className="w-5 h-5 text-ink-500" />
                          </div>
                          <span className="font-medium">Loading your profile...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Show doctor selection dropdown for admin
                  <div className="doctor-dropdown relative">
                    <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                      <div className="p-1.5 bg-brand-violet-soft rounded-lg">
                        <Stethoscope className="w-4 h-4 text-brand-violet" />
                      </div>
                      Select Doctor *
                    </label>
                    <div className="relative">
                      <div
                        className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer bg-gradient-to-br transition-all duration-200 ${
                          selectedDoctor 
                            ? 'border-brand-violet from-brand-violet-soft to-brand-violet-soft shadow-sm' 
                            : 'border-border from-white to-white hover:border-brand-violet/20 hover:shadow-sm'
                        }`}
                        onClick={() => setShowDoctorList((s) => !s)}
                      >
                        <div className="flex-1">
                          {selectedDoctor ? (
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-br from-brand-violet to-brand-violet rounded-xl flex items-center justify-center shadow-md">
                                  <Stethoscope className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-status-open rounded-full border-2 border-white"></div>
                              </div>
                              <div>
                                <div className="font-semibold text-ink-900">{selectedDoctor.name}</div>
                                <div className="text-sm text-ink-700 flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 bg-brand-violet rounded-full"></span>
                                  {selectedDoctor.specialization}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-ink-500">
                              <div className="w-10 h-10 bg-surface-canvas rounded-xl flex items-center justify-center">
                                <Stethoscope className="w-5 h-5 text-ink-500" />
                              </div>
                              <span className="font-medium">Choose a doctor</span>
                            </div>
                          )}
                        </div>
                        <div className={`transition-transform duration-200 ${showDoctorList ? 'rotate-180' : ''}`}>
                          <ChevronDown className="w-5 h-5 text-ink-500" />
                        </div>
                      </div>

                      {showDoctorList && (
                        <div className="absolute z-20 w-full mt-2 bg-surface-paper border-2 border-brand-violet/20 rounded-xl shadow-2xl max-h-80 overflow-hidden">
                          <div className="p-3 border-b border-border bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-violet w-4 h-4" />
                              <input
                                type="text"
                                placeholder="Search doctors by name or specialization..."
                                value={doctorSearch}
                                onChange={(e) => setDoctorSearch(e.target.value)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full pl-10 pr-4 py-2.5 border-2 border-brand-violet/20 rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet bg-surface-paper"
                              />
                            </div>
                          </div>

                          <div className="p-2 max-h-64 overflow-y-auto">
                            {filteredDoctors.length > 0 ? (
                              filteredDoctors.map((doctor) => (
                                <div
                                  key={doctor.id}
                                  onClick={() => {
                                    setSelectedDoctor(doctor);
                                    setShowDoctorList(false);
                                    setDoctorSearch("");
                                  }}
                                  className="p-3 rounded-lg cursor-pointer hover:bg-gradient-to-r hover:from-brand-violet-soft hover:to-brand-violet-soft border-2 border-transparent hover:border-brand-violet/20 transition-all duration-200 mb-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-brand-violet to-brand-violet rounded-lg flex items-center justify-center flex-shrink-0">
                                      <Stethoscope className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-semibold text-ink-900">{doctor.name}</div>
                                      <div className="text-sm text-ink-700">{doctor.specialization}</div>
                                      {doctor.availability && (
                                        <div className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          {doctor.availability.map((a) => a.day.substring(0, 3)).join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-6 text-center text-ink-500">
                                <Stethoscope className="w-12 h-12 text-border mx-auto mb-2" />
                                <p className="font-medium">No doctors found</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Patient Selection */}
                <div className="patient-dropdown relative">
                  <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-status-open-soft rounded-lg">
                      <User className="w-4 h-4 text-status-open" />
                    </div>
                    Select Patient *
                  </label>
                  <div className="relative">
                    <div
                      className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer bg-gradient-to-br transition-all duration-200 ${
                        selectedPatient 
                          ? 'border-status-open from-status-open-soft to-status-open-soft shadow-sm' 
                          : 'border-border from-white to-white hover:border-status-open/20 hover:shadow-sm'
                      }`}
                      onClick={() => setShowPatientList((s) => !s)}
                    >
                      <div className="flex-1">
                        {selectedPatient ? (
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 bg-gradient-to-br from-status-open to-status-open rounded-xl flex items-center justify-center shadow-md">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-violet rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                              <div className="font-semibold text-ink-900">{selectedPatient.name}</div>
                              {selectedPatient.email && (
                                <div className="text-sm text-ink-700 flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 bg-status-open rounded-full"></span>
                                  {selectedPatient.email}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 text-ink-500">
                            <div className="w-10 h-10 bg-surface-canvas rounded-xl flex items-center justify-center">
                              <User className="w-5 h-5 text-ink-500" />
                            </div>
                            <span className="font-medium">Choose a patient</span>
                          </div>
                        )}
                      </div>
                      <div className={`transition-transform duration-200 ${showPatientList ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-5 h-5 text-ink-500" />
                      </div>
                    </div>

                    {showPatientList && (
                      <div className="absolute z-20 w-full mt-2 bg-surface-paper border-2 border-status-open/20 rounded-xl shadow-2xl max-h-80 overflow-hidden">
                        <div className="p-3 border-b border-border bg-gradient-to-r from-status-open-soft to-status-open-soft">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-status-open w-4 h-4" />
                            <input
                              type="text"
                              placeholder="Search patients by name or email..."
                              value={patientSearch}
                              onChange={(e) => setPatientSearch(e.target.value)}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full pl-10 pr-4 py-2.5 border-2 border-status-open/20 rounded-lg focus:ring-2 focus:ring-status-open focus:border-status-open bg-surface-paper"
                            />
                          </div>
                        </div>

                        <div className="p-2 max-h-64 overflow-y-auto">
                          {filteredPatients.length > 0 ? (
                            filteredPatients.map((patient) => (
                              <div
                                key={patient.id}
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  setShowPatientList(false);
                                  setPatientSearch("");
                                }}
                                className="p-3 rounded-lg cursor-pointer hover:bg-gradient-to-r hover:from-status-open-soft hover:to-status-open-soft border-2 border-transparent hover:border-status-open/20 transition-all duration-200 mb-2"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-status-open to-status-open rounded-lg flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-ink-900">{patient.name}</div>
                                    {patient.email && (
                                      <div className="text-sm text-ink-700">{patient.email}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-6 text-center text-ink-500">
                              <User className="w-12 h-12 text-border mx-auto mb-2" />
                              <p className="font-medium">No patients found</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-ink-900 mb-3">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full p-4 border-2 border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-brand-violet resize-none transition-all duration-200 hover:border-border"
                    placeholder="Any special instructions or notes about this appointment..."
                  />
                </div>
              </div>

              {/* Right Column - Scheduling */}
              <div className="space-y-6">
                {/* Frequency */}
                <div>
                  <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-brand-violet-soft rounded-lg">
                      <Calendar className="w-4 h-4 text-brand-violet" />
                    </div>
                    Schedule Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "once", label: "One-time", icon: "📅" },
                      { value: "weekly", label: "Weekly", icon: "🔄" },
                      { value: "monthly", label: "Monthly", icon: "📆" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFrequency(option.value as any)}
                        className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-sm font-semibold overflow-hidden ${
                          frequency === option.value
                            ? "bg-gradient-to-br from-brand-violet to-brand-violet text-white border-brand-violet shadow-lg scale-105"
                            : "bg-surface-paper text-ink-700 border-border hover:border-brand-violet hover:shadow-md"
                        }`}
                      >
                        <div className="relative z-10 flex flex-col items-center gap-1">
                          <span className="text-lg">{option.icon}</span>
                          <span>{option.label}</span>
                        </div>
                        {frequency === option.value && (
                          <div className="absolute top-1 right-1">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Appointment Date */}
                <div>
                  <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-brand-violet-soft rounded-lg">
                      <Calendar className="w-4 h-4 text-brand-violet" />
                    </div>
                    Start Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={appointmentDate}
                      onChange={(e) => {
                        const selected = e.target.value;
                        const today = new Date().toISOString().split("T")[0];
                        if (selected < today) {
                          toast.error("Please select a date that is today or in the future.");
                          return;
                        }
                        setAppointmentDate(selected);
                      }}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3.5 border-2 border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-all duration-200 hover:border-border font-medium text-ink-700"
                      required
                    />
                  </div>
                  {appointmentDate && (
                    <div className="mt-2 p-3 bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft rounded-lg border border-brand-violet/20">
                      <p className="text-sm font-medium text-brand-violet flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(appointmentDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Appointment Time */}
                <div>
                  <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-brand-violet-soft rounded-lg">
                      <Clock className="w-4 h-4 text-brand-violet" />
                    </div>
                    Preferred Time *
                  </label>
                  {availableSlots.length > 0 ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft rounded-lg border border-brand-violet/20">
                        <p className="text-xs font-semibold text-brand-violet flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          {availableSlots.length} time slot{availableSlots.length !== 1 ? 's' : ''} available
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setAppointmentTime(slot)}
                            className={`relative p-3 rounded-xl border-2 transition-all duration-200 font-semibold text-sm ${
                              appointmentTime === slot
                                ? "bg-gradient-to-br from-brand-violet to-brand-violet text-white border-brand-violet shadow-lg scale-105"
                                : "bg-surface-paper text-ink-700 border-border hover:border-brand-violet hover:shadow-md hover:scale-102"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Clock className={`w-4 h-4 ${appointmentTime === slot ? 'text-white' : 'text-brand-violet'}`} />
                              <span>{slot}</span>
                            </div>
                            {appointmentTime === slot && (
                              <div className="absolute -top-1 -right-1">
                                <CheckCircle2 className="w-5 h-5 text-status-open bg-surface-paper rounded-full" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      {appointmentTime && (
                        <div className="p-3 bg-gradient-to-r from-status-open-soft to-status-open-soft rounded-lg border border-status-open/20">
                          <p className="text-sm font-semibold text-status-open flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Selected: {appointmentTime}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-gradient-to-r from-status-warning-soft to-status-warning-soft rounded-xl text-status-warning text-sm border-2 border-status-warning/20">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-1">
                            {selectedDoctor && appointmentDate 
                              ? "No available slots" 
                              : "Select doctor and date"
                            }
                          </p>
                          <p className="text-xs text-status-warning">
                            {selectedDoctor && appointmentDate 
                              ? "No available slots for this date. Please select another date." 
                              : "Select a doctor and date to see available time slots"
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Weekly Options */}
                {frequency === "weekly" && selectedDoctor && (
                  <div className="bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft p-5 rounded-xl border-2 border-brand-violet/20">
                    <label className="block text-sm font-semibold text-ink-900 mb-3 flex items-center gap-2">
                      <span className="text-lg">🗓️</span>
                      Select Days (Based on Doctor's Availability)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {daysOfWeek.map((day) => {
                        const isAvailable = availableDays.includes(day);
                        const isSelected = selectedDays.includes(day);
                        
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => isAvailable && toggleDaySelection(day)}
                            className={`relative px-3 py-2.5 rounded-lg text-xs font-bold border-2 transition-all duration-200 ${
                              !isAvailable
                                ? "bg-surface-canvas text-ink-500 border-border cursor-not-allowed opacity-50"
                                : isSelected
                                ? "bg-gradient-to-br from-brand-violet to-brand-violet text-white border-brand-violet shadow-md scale-105"
                                : "bg-surface-paper text-ink-700 border-border hover:border-brand-violet hover:shadow-sm"
                            }`}
                          >
                            {day.substring(0, 3)}
                            {isSelected && (
                              <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-status-open bg-surface-paper rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-brand-violet mt-3 font-medium">
                      {selectedDays.length > 0 
                        ? `✓ Appointments on ${selectedDays.map(d => d.substring(0, 3)).join(", ")} each week`
                        : "⚠️ Please select at least one day"
                      }
                    </p>
                  </div>
                )}

                {/* Monthly Options */}
                {frequency === "monthly" && (
                  <div className="bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft p-5 rounded-xl border-2 border-brand-violet/20">
                    <label className="block text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
                      <span className="text-lg">📆</span>
                      Monthly Appointments
                    </label>
                    <p className="text-sm text-brand-violet font-medium">
                      Appointments will be scheduled on the same date each month, adjusted for doctor's availability.
                    </p>
                  </div>
                )}

                {/* Number of Occurrences */}
                {frequency !== "once" && (
                  <div>
                    <label className="block text-sm font-semibold text-ink-900 mb-3">
                      Number of Appointments
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={numberOfOccurrences}
                      onChange={(e) => setNumberOfOccurrences(Math.max(1, parseInt(e.target.value || "1")))}
                      className="w-full px-4 py-3.5 border-2 border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-all duration-200 hover:border-border font-semibold text-ink-700 text-lg"
                    />
                    {calculateEndDate() && (
                      <div className="mt-2 p-3 bg-gradient-to-r from-status-open-soft to-status-open-soft rounded-lg border border-status-open/20">
                        <p className="text-sm font-medium text-status-open flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Schedule ends on: <strong>{new Date(calculateEndDate()).toLocaleDateString()}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-border">
              <button
                type="submit"
                disabled={!isValid || saving}
                className={`relative group flex items-center justify-center gap-2 flex-1 px-6 py-4 rounded-xl font-bold text-base transition-all duration-200 overflow-hidden ${
                  !isValid || saving
                    ? "bg-border text-ink-500 cursor-not-allowed"
                    : "bg-brand-violet hover:bg-brand-violet-hover text-white shadow-lg hover:shadow-xl"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                    <span className="relative z-10">Scheduling...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Schedule Appointment{frequency !== "once" ? "s" : ""}</span>
                  </>
                )}
              </button>

              <button 
                type="button" 
                onClick={() => navigateToHospitalRoute("appointments", hospitalId)} 
                className="px-6 py-4 border-2 border-border text-ink-700 rounded-xl hover:bg-surface-canvas hover:border-ink-500 transition-all duration-200 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>

        {/* Info Card */}
        <div className="mt-6 bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft rounded-xl md:rounded-2xl border-2 border-brand-violet/20 overflow-hidden shadow-md">
          <div className="bg-gradient-to-r from-brand-violet to-brand-violet px-5 py-3">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Scheduling Information
            </h4>
          </div>
          <div className="p-5">
            <ul className="text-brand-violet text-sm space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="text-brand-violet font-bold mt-0.5">•</span>
                <span>Available time slots are based on the doctor's schedule and existing appointments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-violet font-bold mt-0.5">•</span>
                <span>For weekly appointments, you can only select days when the doctor is available</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-violet font-bold mt-0.5">•</span>
                <span>If your preferred time is not available, the system will find the next available slot</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-violet font-bold mt-0.5">•</span>
                <span>Monthly appointments will be scheduled on the same date each month, adjusted for availability</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-violet font-bold mt-0.5">•</span>
                <span>Patients will receive notifications about their scheduled appointments</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
