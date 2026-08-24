import { z } from 'zod';
import {
  extendPackageSchema,
  previewPackageScheduleSchema,
  sellPackageSchema,
} from '../common/validation/schemas';

export type PreviewPackageScheduleBody = z.infer<
  typeof previewPackageScheduleSchema
>;
export type SellPackageBody = z.infer<typeof sellPackageSchema>;
export type ExtendPackageBody = z.infer<typeof extendPackageSchema>;

export interface PackageListQuery {
  patientId?: string;
  doctorProfileId?: string;
}
