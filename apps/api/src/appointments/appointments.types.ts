import { z } from 'zod';
import { createAppointmentSchema, updateAppointmentSchema, finishSessionSchema } from '../common/validation/schemas';

export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentBody = z.infer<typeof updateAppointmentSchema>;
export type FinishSessionBody = z.infer<typeof finishSessionSchema>;

export interface AppointmentListQuery {
  startDate?: string;
  endDate?: string;
  status?: string;
  doctorId?: string;
  patientId?: string;
  limit?: string;
}
