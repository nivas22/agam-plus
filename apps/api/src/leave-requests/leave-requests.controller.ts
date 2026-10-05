import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import type { LeaveAppointmentResolution } from './leave-requests.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { RequiresModule } from '../auth/decorators/requires-module.decorator';
import { HOSPITAL_MODULE } from '../constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';

// Anyone who can file leave (doctors and staff) only ever sees/acts on their
// own requests — resolved from the membership context, never taken from a
// query param. Admins see the whole hospital. Same pattern as
// ReportsController's scopeFor().
function scopeFor(userProfile: HospitalUserProfile): string | undefined {
  return userProfile.role === 'admin' ? undefined : userProfile.userId;
}

const REQUESTER_ROLES = ['doctor', 'front_desk', 'nurse', 'accountant'];

@Controller('hospitals/:id/leave-requests')
@UseGuards(HospitalContextGuard)
@RequiresModule(HOSPITAL_MODULE.LEAVE_REQUESTS)
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @Roles('admin', ...REQUESTER_ROLES)
  list(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('status') status?: string,
  ) {
    return this.leaveRequestsService.list(hospitalId, { doctorProfileId: scopeFor(userProfile), status });
  }

  @Get('on-leave')
  @Roles('admin', ...REQUESTER_ROLES)
  onLeave(
    @Param('id') hospitalId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.leaveRequestsService.listOnLeave(hospitalId, startDate, endDate);
  }

  @Post('preview-impact')
  @Roles(...REQUESTER_ROLES)
  previewImpact(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { startDate: string; endDate: string },
  ) {
    return this.leaveRequestsService.previewImpact(hospitalId, userProfile, body);
  }

  @Post()
  @Roles(...REQUESTER_ROLES)
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { startDate: string; endDate: string; reason?: string },
  ) {
    return this.leaveRequestsService.create(hospitalId, userProfile, body);
  }

  @Post(':leaveRequestId/nudge')
  @Roles(...REQUESTER_ROLES)
  nudge(
    @Param('id') hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.leaveRequestsService.nudge(hospitalId, leaveRequestId, userProfile);
  }

  @Get(':leaveRequestId/affected-appointments')
  @Roles('admin')
  affectedAppointments(@Param('id') hospitalId: string, @Param('leaveRequestId') leaveRequestId: string) {
    return this.leaveRequestsService.getAffectedAppointments(hospitalId, leaveRequestId);
  }

  @Post(':leaveRequestId/approve')
  @Roles('admin')
  approve(
    @Param('id') hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { note?: string; resolutions?: LeaveAppointmentResolution[] },
  ) {
    return this.leaveRequestsService.approve(hospitalId, leaveRequestId, userProfile, body);
  }

  @Post(':leaveRequestId/decline')
  @Roles('admin')
  decline(
    @Param('id') hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { note?: string },
  ) {
    return this.leaveRequestsService.decline(hospitalId, leaveRequestId, userProfile, body);
  }
}
