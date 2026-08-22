// types/package.ts
export type PackagePaymentMethod = "cash" | "upi" | "card";
export type PackageStatus = "active" | "expired" | "cancelled" | "refunded";
export type PackageDisplayStatus =
  | "active"
  | "lapsing"
  | "used_up"
  | "lapsed"
  | "refunded"
  | "cancelled";
export type PackageFrequency = "weekly" | "every-3-days";

export interface PackageVisitAlternate {
  date: string;
  time: string;
}

export interface PackageVisitPlan {
  visitNumber: number;
  plannedDate: string;
  date?: string;
  time?: string;
  moved?: boolean;
  reason?: string | null;
  unplaced?: true;
  alternates: PackageVisitAlternate[];
}

export interface PreviewSchedulePayload {
  doctorProfileId: string;
  startDate: string;
  preferredTime: string;
  frequency: PackageFrequency;
  daysOfWeek: number[];
  count: number;
}

export interface PreviewScheduleResponse {
  doctor: {
    id: string;
    name: string;
    specialization?: string;
    consultationFee: number;
    appointmentDuration: number;
  };
  visits: PackageVisitPlan[];
}

export interface SellPackageVisit {
  date: string;
  time: string;
}

export interface SellPackagePayload {
  patientId: string;
  doctorProfileId: string;
  totalVisits: number;
  pricePerVisit: number;
  paymentMethod: PackagePaymentMethod;
  visits: SellPackageVisit[];
}

export interface PackageRecord {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  doctorProfileId: string;
  doctorName?: string;
  totalVisits: number;
  usedVisits: number;
  pricePerVisit: number;
  totalPrice: number;
  status: PackageStatus;
  validUntil: string;
  paymentMethod: PackagePaymentMethod;
  amountPaid: number;
  collectedBy?: string;
  refundedAmount?: number;
  refundedAt?: string;
  refundedBy?: string;
  createdAt: string;
  // Derived server-side, on every read — never stored.
  remainingVisits: number;
  valueLeft: number;
  daysUntilExpiry: number;
  displayStatus: PackageDisplayStatus;
}

export interface SellPackageResponse {
  success: boolean;
  message: string;
  package: PackageRecord;
  appointmentIds: string[];
}

export interface PackagesListResponse {
  packages: PackageRecord[];
  total: number;
}

export interface PackageStats {
  soldThisMonth: { amount: number; count: number; patients: number };
  unredeemed: { value: number; patients: number; visits: number };
  lapsingSoon: { value: number; patients: number; visits: number };
  redeemedToday: { visits: number; cashCollected: number };
}

export interface PackageLedgerVisit {
  id: string;
  date: string;
  time: string;
  status: string;
  packageVisitNumber?: number;
}

export interface PackageLedgerResponse {
  package: PackageRecord;
  visits: PackageLedgerVisit[];
}

export interface ExtendPackagePayload {
  months: number;
}

export interface ExtendPackageResponse {
  package: PackageRecord;
}

export interface RefundPackageResponse {
  package: PackageRecord;
}
