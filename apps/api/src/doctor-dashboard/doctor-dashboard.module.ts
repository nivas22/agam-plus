import { Module } from '@nestjs/common';
import { DoctorDashboardController } from './doctor-dashboard.controller';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [DoctorDashboardController],
  providers: [DoctorDashboardService],
})
export class DoctorDashboardModule {}
