import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DoctorPresenceService } from './doctor-presence.service';
import type { SetDoctorPresenceBody } from './doctor-presence.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';

@Controller('hospitals/:id/doctor-presence')
@UseGuards(HospitalContextGuard)
export class DoctorPresenceController {
  constructor(private readonly doctorPresenceService: DoctorPresenceService) {}

  // No @Roles restriction — any authenticated hospital member (front desk,
  // nurse, accountant, doctor, admin) can see who's in today, same as the
  // doctors list itself is visible hospital-wide.
  @Get()
  getForDate(@Param('id') hospitalId: string, @Query('date') date: string) {
    return this.doctorPresenceService.getForDate(hospitalId, date);
  }

  // :doctorId as a route param (rather than in the body) is deliberate —
  // HospitalContextGuard already rejects a 'doctor' caller acting on any
  // doctorId but their own, so a doctor marking themself "here" doesn't
  // need its own scoping check here.
  @Post(':doctorId')
  @Roles('admin', 'doctor', 'front_desk')
  setPresence(
    @Param('id') hospitalId: string,
    @Param('doctorId') doctorId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: SetDoctorPresenceBody,
  ) {
    return this.doctorPresenceService.setPresence(
      hospitalId,
      doctorId,
      userProfile,
      body,
    );
  }
}
