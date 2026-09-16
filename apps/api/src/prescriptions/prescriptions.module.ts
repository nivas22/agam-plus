import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { AuthModule } from '../auth/auth.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [AuthModule, AppointmentsModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
