import { Module } from '@nestjs/common';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';
import { PatientAuthGuard } from './guards/patient-auth.guard';

@Module({
  controllers: [PatientAuthController],
  providers: [PatientAuthService, PatientAuthGuard],
})
export class PatientAuthModule {}
