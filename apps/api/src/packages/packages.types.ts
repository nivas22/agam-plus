import { z } from 'zod';
import {
  previewPackageScheduleSchema,
  sellPackageSchema,
} from '../common/validation/schemas';

export type PreviewPackageScheduleBody = z.infer<
  typeof previewPackageScheduleSchema
>;
export type SellPackageBody = z.infer<typeof sellPackageSchema>;

export interface PackageListQuery {
  patientId?: string;
}
