// types/payment.ts
export interface PaymentItem {
  name: string;
  quantity: number;
  unitPrice: number;
  chargeCatalogItemId?: string;
  isAuto?: boolean;
  isPackageCovered?: boolean;
}

export type PaymentMethod = "cash" | "upi" | "split" | "due";
export type PaymentStatus = "paid" | "due" | "refunded";
export type FollowUpOption =
  | "none"
  | "3-days"
  | "1-week"
  | "2-weeks"
  | "1-month";

export interface Payment {
  id: string;
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  doctorProfileId?: string;
  doctorName?: string;
  invoiceNumber: string;
  invoiceYear: number;
  items: PaymentItem[];
  subtotal: number;
  discount: number;
  total: number;
  method: PaymentMethod;
  status: PaymentStatus;
  amountTendered?: number;
  changeDue?: number;
  collectedBy?: string;
  upiReference?: string;
  splitCashAmount?: number;
  splitUpiAmount?: number;
  dueReason?: string;
  settledAt?: string;
  refundedAt?: string;
  refundReason?: string;
  sendReceiptWhatsApp?: boolean;
  packageId?: string;
  packageCoveredAmount?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteVisitPayload {
  appointmentId: string;
  sessionNotes?: string;
  followUp?: FollowUpOption;
  items: PaymentItem[];
  discount?: number;
  method: PaymentMethod;
  amountTendered?: number;
  collectedBy?: string;
  upiReference?: string;
  splitCashAmount?: number;
  splitUpiAmount?: number;
  dueReason?: string;
  sendReceiptWhatsApp?: boolean;
  usePackageVisit?: boolean;
}

export interface CompleteVisitResponse {
  success: boolean;
  message: string;
  payment: Payment;
  followUpAppointmentId?: string | null;
}

export interface PaymentListResponse {
  payments: Payment[];
  total: number;
}

export interface SettlePaymentPayload {
  status: "paid";
  method: "cash" | "upi";
  amountTendered?: number;
  collectedBy?: string;
  upiReference?: string;
}

export interface RefundPaymentPayload {
  status: "refunded";
  refundReason: string;
}

export interface AddUtrPayload {
  upiReference: string;
}

export interface DayClose {
  date: string;
  openingFloat: number;
  cashCollected: number;
  upiCollected: number;
  unpaid: number;
  refundsPaidOut: number;
  expectedDrawer: number;
  closed: boolean;
  countedAmount?: number;
  variance?: number;
  note?: string;
  closedBy?: string;
  closedAt?: string;
}

export interface CloseDayPayload {
  date: string;
  openingFloat: number;
  countedAmount: number;
  note?: string;
}
