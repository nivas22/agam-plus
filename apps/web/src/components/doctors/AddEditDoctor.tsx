"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    ArrowLeft,
    Save,
    ChevronRight,
    ChevronLeft,
    User,
    Briefcase,
    Clock,
    Stethoscope
} from "lucide-react";
import { CreateDoctorData, Doctor } from "@/types/doctorNew";
import { StepAvailability } from "@/components/doctors/StepAvailability";
import { StepProfessional } from "@/components/doctors/StepProfessional";
import { StepPersonal } from "@/components/doctors/StepPersonal";
import { useNewDoctorApi, useHospitalDoctor } from "@/hooks/useNewDoctorApi";
import { TimeSlot } from "@/types/appointment";
import { GENDER } from "@agam-plus/shared";

interface AddEditDoctorProps {
    isNew?: boolean;
    id?: string;
    userRole?: string;
    canEdit?: boolean;
    hospitalId?: string;

}

export default function AddEditDoctor({ 
    isNew = false, 
    id,
    hospitalId, 
}: AddEditDoctorProps) {
    const router = useRouter();
    const { createDoctor, updateDoctor } = useNewDoctorApi(hospitalId, undefined, true);
    const { data: doctorData, isLoading: isDoctorLoading } = useHospitalDoctor(id || "", hospitalId);
    const [saving, setSaving] = useState(false);
    const [activeDay, setActiveDay] = useState<string>("Monday");
    const [newTimeSlot, setNewTimeSlot] = useState<TimeSlot>({
        day: 'Monday',
        startTime: '',
        endTime: ''
    });
    const [currentStep, setCurrentStep] = useState<number>(1);
    const totalSteps = 3;

    const [formData, setFormData] = useState<Partial<CreateDoctorData>>({
        name: "",
        hospitalId: hospitalId || "",
        email: "",
        phone: "",
        specialization: "",
        experience: undefined,
        location: "",
        gender: "",
        maritalStatus: "",
        status: "pending",
        availability: [],
        appointmentDuration: 30,
        address: "",
    });

    const specializations = [
        "General Practitioner",
        "Cardiologist",
        "Dermatologist",
        "Neurologist",
        "Pediatrician",
        "Orthopedic Surgeon",
        "Ophthalmologist",
        "Psychiatrist",
        "Dentist",
        "Gynecologist",
        "Urologist",
        "Endocrinologist",
        "Gastroenterologist",
        "Pulmonologist",
        "Oncologist",
        "Rheumatologist",
        "Nephrologist",
        "ENT Specialist",
    ];
    const genders = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
    const maritalStatuses = ["Single", "Married"];
    const daysOfWeek = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ];
    const durationOptions = [15, 20, 30, 45, 60];
    const timeOptions: string[] = Array.from(
        { length: 48 },
        (_, i) =>
            `${Math.floor(i / 2)
                .toString()
                .padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`
    );

    // useEffect(() => {
    //     const loadDoctors = async () => {
    //         try {
    //             await fetchDoctors();
    //         } catch (error) {
    //             console.error("Error fetching doctors:", error);
    //         }
    //     };
    //     loadDoctors();
    // }, []);

    useEffect(() => {
        if (!isNew && doctorData?.doctor) {
            const docData = doctorData.doctor as Doctor;
            setFormData({
                ...docData,
                availability: docData.availability || [],
                appointmentDuration: docData.appointmentDuration || 30,
                location: docData.location || "",
                gender: docData.gender || "",
                maritalStatus: docData.maritalStatus || "",
                address: docData.address || "",
            });
        }
    }, [isNew, doctorData]);

    const handleInputChange = (
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "experience" ? Number(value) : value,
        }));
    };

    const handleSelectChange = (field: keyof Doctor, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // const addTimeSlot = () => {
    //     if (newTimeSlot.startTime >= newTimeSlot.endTime)
    //         return alert("End time must be after start time");

    //     setFormData((prev) => {
    //         const updatedAvailability = prev.availability
    //             ? [...prev.availability]
    //             : [];
    //         const index = updatedAvailability.findIndex(
    //             (slot) => slot.day === activeDay
    //         );
    //         const slot = { ...newTimeSlot, day: activeDay };
    //         if (index >= 0) updatedAvailability[index] = slot;
    //         else updatedAvailability.push(slot);
    //         return { ...prev, availability: updatedAvailability };
    //     });
    // };

    // const removeTimeSlot = (day: string) => {
    //     setFormData((prev) => ({
    //         ...prev,
    //         availability: prev.availability?.filter((slot) => slot.day !== day) || [],
    //     }));
    // };

    const addTimeSlot = () => {
        if (!newTimeSlot.startTime || !newTimeSlot.endTime) return;
        setFormData(prev => {
            // Create a new array with the existing slots and add the new one
            const existingSlots = prev.availability || [];
            
            // Check if we're updating an existing slot or adding a new one
            // In this case, we're always adding a new slot
            const updatedSlots = [...existingSlots, {
            day: newTimeSlot.day,
            startTime: newTimeSlot.startTime,
            endTime: newTimeSlot.endTime
            }];
            
            return {
            ...prev,
            availability: updatedSlots
            };
        });
    };

    // CORRECT implementation of removeTimeSlot
    const removeTimeSlot = (day: string, index: number) => {
        setFormData(prev => {
            const existingSlots = prev.availability || [];
            const updatedSlots = existingSlots.filter((slot, i) => 
            !(slot.day === day && i === index)
            );
            
            return {
            ...prev,
            availability: updatedSlots
            };
        });
    };

    const handleDayClick = (day: string) => {
        setActiveDay(day);
        const existing = formData.availability?.find((slot) => slot.day === day);
        setNewTimeSlot(existing ?? { day, startTime: "09:00", endTime: "17:00" });
    };

    const nextStep = () => {
        if (currentStep === 1 && (!formData.name || !formData.email)) {
            toast.error("Please fill in Name and Email", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }
        setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    };
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

    const saveDoctor = async () => {
        if (!formData.name || !formData.email) {
            toast.error("Name and Email are required", {
                duration: 3000,
                position: "top-right",
            });
            return;
        }

        setSaving(true);
        try {
            const payload: CreateDoctorData = {
            name: formData.name ?? "",
            email: formData.email ?? "",
            phone: formData.phone ?? "",
            specialization: formData.specialization ?? "",
            experience: formData.experience ?? "0",
            location: formData.location ?? "",
            gender: formData.gender ?? "",
            maritalStatus: formData.maritalStatus ?? "",
            status: formData.status ?? "pending",
            availability: formData.availability ?? [],
            appointmentDuration: formData.appointmentDuration ?? 30,
            address: formData.address ?? "",
            hospitalId: formData.hospitalId ?? hospitalId ?? "",
            };

            if (!isNew && id) {
            await updateDoctor(id, payload);
            toast.success("Doctor updated successfully!", {
                duration: 3000,
                position: "top-right",
            });
            } else {
            await createDoctor(payload);
            toast.success("Doctor saved successfully! Welcome email sent.", {
                duration: 4000,
                position: "top-right",
            });
            }

            // Delay navigation slightly to show the toast
            setTimeout(() => {
                router.push(`/hospital/${hospitalId}/doctors`);
            }, 500);
        } catch (err) {
            console.error("Error saving doctor:", err);
            toast.error("Failed to save doctor. Please try again.", {
                duration: 4000,
                position: "top-right",
            });
        } finally {
            setSaving(false);
        }
    };


    // Step configuration
    const stepConfig = [
        { icon: User, title: "Personal", description: "Basic info" },
        { icon: Briefcase, title: "Professional", description: "Career details" },
        { icon: Clock, title: "Availability", description: "Schedule" }
    ];

    if (!isNew && isDoctorLoading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading doctor information...</p>
                </div>
            </div>
        );

    return (
        <div className="min-h-screen bg-gray-50 py-4 md:py-8">
            <div className="max-w-4xl mx-auto px-3 sm:px-4">
                {/* Compact Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => router.push(`/hospital/${hospitalId}/doctors`)}
                            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700 hidden xs:inline">Back</span>
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <Stethoscope className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                    {isNew ? "Add New Doctor" : "Edit Doctor"}
                                </h1>
                                <p className="text-gray-600 text-sm mt-1">
                                    {isNew ? "Add a new doctor to the system" : "Update doctor information"}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                    Step {currentStep}/{totalSteps}
                                </div>
                            </div>
                        </div>

                        {/* Compact Stepper */}
                        <div className="mb-2">
                            <div className="flex items-center justify-between relative">
                                {/* Progress line */}
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 -z-10"></div>
                                <div
                                    className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -translate-y-1/2 -z-10 transition-all duration-300"
                                    style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                                ></div>

                                {stepConfig.map((step, index) => {
                                    const StepIcon = step.icon;
                                    const stepNumber = index + 1;
                                    const isCompleted = stepNumber < currentStep;
                                    const isActive = stepNumber === currentStep;

                                    return (
                                        <div key={index} className="flex flex-col items-center relative z-10">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${isCompleted
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : isActive
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                        : 'bg-white border-gray-300 text-gray-400'
                                                }`}>
                                                {isCompleted ? (
                                                    <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                                    </div>
                                                ) : (
                                                    <StepIcon className="w-3 h-3" />
                                                )}
                                            </div>
                                            <div className="text-center mt-2 hidden sm:block">
                                                <div className={`text-xs font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                                                    }`}>
                                                    {step.title}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">{step.description}</div>
                                            </div>
                                            {/* Mobile only - just numbers */}
                                            <div className="text-center mt-1 sm:hidden">
                                                <div className={`text-xs font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                                                    }`}>
                                                    {stepNumber}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Content */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 md:p-6">
                        {currentStep === 1 && (
                            <StepPersonal
                                formData={formData}
                                handleInputChange={handleInputChange}
                                handleSelectChange={handleSelectChange}
                                genders={genders}
                                maritalStatuses={maritalStatuses}
                            />
                        )}
                        {currentStep === 2 && (
                            <StepProfessional
                                formData={formData}
                                handleInputChange={handleInputChange}
                                specializations={specializations}
                            />
                        )}
                        {currentStep === 3 && (
                            <StepAvailability
                                formData={formData}
                                daysOfWeek={daysOfWeek}
                                durationOptions={durationOptions}
                                activeDay={activeDay}
                                setActiveDay={handleDayClick}
                                newTimeSlot={newTimeSlot}
                                setNewTimeSlot={setNewTimeSlot}
                                addTimeSlot={addTimeSlot}
                                removeTimeSlot={removeTimeSlot}
                                timeOptions={timeOptions}
                                setFormData={setFormData}
                            />
                        )}
                    </div>

                    {/* Compact Navigation */}
                    <div className="bg-gray-50 px-4 md:px-6 py-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                {currentStep > 1 && (
                                    <button
                                        onClick={prevStep}
                                        className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors text-sm font-medium"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span className="hidden xs:inline">Previous</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {currentStep < totalSteps ? (
                                    <button
                                        onClick={nextStep}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                                    >
                                        <span>Next</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={saveDoctor}
                                        disabled={saving}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saving ? "Saving..." : isNew ? "Save" : "Update"}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Minimal Step Indicator */}
                        <div className="text-center mt-3">
                            <span className="text-xs text-gray-500">
                                {stepConfig[currentStep - 1]?.title} • Step {currentStep} of {totalSteps}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
