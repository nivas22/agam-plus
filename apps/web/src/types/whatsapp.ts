export interface WhatsappStatus {
  // Whether this hospital has connected a WhatsApp Business account.
  assigned: boolean;
  connected: boolean;
  phoneNumberId?: string;
  wabaId?: string;
  businessPhoneNumber?: string;
  verifiedName?: string;
  connectedAt?: string;
  disconnectedAt?: string;
}

export interface ConnectWhatsappData {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
}

export interface WhatsappEnquiry {
  id: string;
  hospitalId: string;
  fromPhone: string;
  patientId?: string;
  patientName?: string;
  message: string;
  status: "new" | "resolved";
  createdAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
