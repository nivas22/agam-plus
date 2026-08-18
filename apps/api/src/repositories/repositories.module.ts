import { Global, Module } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { MembershipRepository } from './membership.repository';
import { HospitalRepository } from './hospital.repository';
import { DoctorRepository } from './doctor.repository';
import { QueryRepository } from './query.repository';
import { PatientRepository } from './patient.repository';
import { AppointmentRepository } from './appointment.repository';
import { DashboardRepository } from './dashboard.repository';

const repositories = [
  UserRepository,
  MembershipRepository,
  HospitalRepository,
  DoctorRepository,
  QueryRepository,
  PatientRepository,
  AppointmentRepository,
  DashboardRepository,
];

@Global()
@Module({
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
