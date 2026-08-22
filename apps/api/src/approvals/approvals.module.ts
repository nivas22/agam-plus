import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { PackagesModule } from '../packages/packages.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [AuthModule, PaymentsModule, PackagesModule, AppointmentsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
