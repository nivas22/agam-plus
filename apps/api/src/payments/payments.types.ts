import { z } from 'zod';
import {
  completeVisitSchema,
  updatePaymentSchema,
  refundPaymentSchema,
  closeDaySchema,
} from '../common/validation/schemas';

export type CompleteVisitBody = z.infer<typeof completeVisitSchema>;
export type UpdatePaymentBody = z.infer<typeof updatePaymentSchema>;
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;
export type CloseDayBody = z.infer<typeof closeDaySchema>;

export interface PaymentListQuery {
  status?: string;
  method?: string;
  patientId?: string;
  doctorProfileId?: string;
  startDate?: string;
  endDate?: string;
  appointmentId?: string;
  limit?: string;
}
