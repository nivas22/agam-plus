export enum FIREBASE_COLLECTIONS {
  USERS = 'users_new',
  DOCTOR_PROFILES = 'doctorProfiles_new_1',
  PATIENTS = 'patients_new_1',
  APPOINTMENTS = 'appointments_new',
  HOSPITALS = 'hospitals_new',
  HOSPITAL_MEMBERS = 'hospitalMembers_new_1',
  REVIEWS = 'reviews',
  DOCTOR_ACTIVIES = 'doctor_activities'
}

export enum ROLE {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  STAFF = 'staff',
}

export enum MEMBERSHIP_STATUS {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum GENDER {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

export const MEDICAL_SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'General Surgery',
  'Gynecology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Otolaryngology (ENT)',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Urology',
  'Anesthesiology',
  'Emergency Medicine',
  'Nephrology',
  'Pathology',
  'Physical Medicine',
  'Plastic Surgery',
] as const;