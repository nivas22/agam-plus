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
    ]),
  ],
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
