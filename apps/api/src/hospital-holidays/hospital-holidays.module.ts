import { Module } from '@nestjs/common';
import { HospitalHolidaysController } from './hospital-holidays.controller';
import { HospitalHolidaysService } from './hospital-holidays.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HospitalHolidaysController],
  providers: [HospitalHolidaysService],
  exports: [HospitalHolidaysService],
})
export class HospitalHolidaysModule {}
