import { Module } from '@nestjs/common';
import { DoctorPresenceController } from './doctor-presence.controller';
import { DoctorPresenceService } from './doctor-presence.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DoctorPresenceController],
  providers: [DoctorPresenceService],
  exports: [DoctorPresenceService],
})
export class DoctorPresenceModule {}
