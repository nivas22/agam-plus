import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { DatabaseModule } from './database/database.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { DoctorsModule } from './doctors/doctors.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PaymentsModule } from './payments/payments.module';
import { PackagesModule } from './packages/packages.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditModule } from './audit/audit.module';
import { TeamModule } from './team/team.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ChargeCatalogModule } from './charge-catalog/charge-catalog.module';
import { HospitalHolidaysModule } from './hospital-holidays/hospital-holidays.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    DatabaseModule,
    RepositoriesModule,
    EmailModule,
    AuthModule,
    PermissionsModule,
    AuditModule,
    HospitalsModule,
    DoctorsModule,
    PatientsModule,
    AppointmentsModule,
    PaymentsModule,
    PackagesModule,
    TeamModule,
    ApprovalsModule,
    ChargeCatalogModule,
    HospitalHolidaysModule,
    PlatformAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
