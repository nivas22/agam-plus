import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRepository } from './user.repository';
import { MembershipRepository } from './membership.repository';
import { HospitalRepository } from './hospital.repository';
import { DoctorRepository } from './doctor.repository';
import { PatientRepository } from './patient.repository';
import { AppointmentRepository } from './appointment.repository';
import { DashboardRepository } from './dashboard.repository';
import { PaymentRepository } from './payment.repository';
import { PaymentDayCloseRepository } from './payment-day-close.repository';
import { PackageRepository } from './package.repository';
import { TeamMemberRepository } from './team-member.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { AuditLogRepository } from './audit-log.repository';
import { ApprovalRequestRepository } from './approval-request.repository';
import { ChargeCatalogItemRepository } from './charge-catalog-item.repository';
import { HospitalHolidayRepository } from './hospital-holiday.repository';
import { MedicineRepository } from './medicine.repository';
import { PrescriptionRepository } from './prescription.repository';
import { LeaveRequestRepository } from './leave-request.repository';
import { DoctorPresenceRepository } from './doctor-presence.repository';
import { User, UserSchema } from '../schemas/user.schema';
import { Hospital, HospitalSchema } from '../schemas/hospital.schema';
import {
  HospitalMember,
  HospitalMemberSchema,
} from '../schemas/hospital-member.schema';
import {
  DoctorProfile,
  DoctorProfileSchema,
} from '../schemas/doctor-profile.schema';
import { Patient, PatientSchema } from '../schemas/patient.schema';
import { Appointment, AppointmentSchema } from '../schemas/appointment.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import {
  PaymentDayClose,
  PaymentDayCloseSchema,
} from '../schemas/payment-day-close.schema';
import { Package, PackageSchema } from '../schemas/package.schema';
import { TeamMemberProfile, TeamMemberProfileSchema } from '../schemas/team-member-profile.schema';
import { RolePermission, RolePermissionSchema } from '../schemas/role-permission.schema';
import { AuditLogEntry, AuditLogEntrySchema } from '../schemas/audit-log.schema';
import { ApprovalRequest, ApprovalRequestSchema } from '../schemas/approval-request.schema';
import {
  ChargeCatalogItem,
  ChargeCatalogItemSchema,
} from '../schemas/charge-catalog-item.schema';
import {
  HospitalHoliday,
  HospitalHolidaySchema,
} from '../schemas/hospital-holiday.schema';
import { Medicine, MedicineSchema } from '../schemas/medicine.schema';
import { Prescription, PrescriptionSchema } from '../schemas/prescription.schema';
import { LeaveRequest, LeaveRequestSchema } from '../schemas/leave-request.schema';
import { Counter, CounterSchema } from '../schemas/counter.schema';
import {
  DoctorPresence,
  DoctorPresenceSchema,
} from '../schemas/doctor-presence.schema';

const repositories = [
  UserRepository,
  MembershipRepository,
  HospitalRepository,
  DoctorRepository,
  PatientRepository,
  AppointmentRepository,
  DashboardRepository,
  PaymentRepository,
  PaymentDayCloseRepository,
  PackageRepository,
  TeamMemberRepository,
  RolePermissionRepository,
  AuditLogRepository,
  ApprovalRequestRepository,
  ChargeCatalogItemRepository,
  HospitalHolidayRepository,
  MedicineRepository,
  PrescriptionRepository,
  LeaveRequestRepository,
  DoctorPresenceRepository,
];

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Hospital.name, schema: HospitalSchema },
      { name: HospitalMember.name, schema: HospitalMemberSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: Patient.name, schema: PatientSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentDayClose.name, schema: PaymentDayCloseSchema },
      { name: Package.name, schema: PackageSchema },
      { name: TeamMemberProfile.name, schema: TeamMemberProfileSchema },
      { name: RolePermission.name, schema: RolePermissionSchema },
      { name: AuditLogEntry.name, schema: AuditLogEntrySchema },
      { name: ApprovalRequest.name, schema: ApprovalRequestSchema },
      { name: ChargeCatalogItem.name, schema: ChargeCatalogItemSchema },
      { name: HospitalHoliday.name, schema: HospitalHolidaySchema },
      { name: Medicine.name, schema: MedicineSchema },
      { name: Prescription.name, schema: PrescriptionSchema },
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: DoctorPresence.name, schema: DoctorPresenceSchema },
    ]),
  ],
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
