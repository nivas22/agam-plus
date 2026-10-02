// Shared between apps/web, apps/api and apps/doctor.
// Subpath imports (@agam/shared/types/auth, @agam/shared/api/client) are also
// available and are what apps/web's src/types/* shims re-export.

export * from "./version";

export * from "./api/client";
export * from "./api/auth";
export * from "./api/doctor";

export type * from "./types/auth";
export type * from "./types/doctorNew";
export type * from "./types/appointment";
export type * from "./types/patient";
export type * from "./types/leaveRequest";
export type * from "./types/doctorDashboard";
export type * from "./types/medicine";
export type * from "./types/prescription";
export type * from "./types/medicinePack";

export * from "./prescriptionDose";
export * from "./prescriptionInstructionTemplate";

// ./types/doctor is deliberately NOT re-exported here: it is the legacy shape
// and collides with ./types/doctorNew on Doctor, HospitalMember, TimeSlot,
// DoctorResponse, ApiResponse and DOCTOR_STATUS_OPTIONS. Web still reaches it
// via the @agam/shared/types/doctor subpath; new code should use doctorNew.
