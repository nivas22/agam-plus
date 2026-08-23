import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';

// A doctor caller only ever sees/acts on their own leave requests — resolved
// from the membership context, never taken from a query param. Same pattern
// as ReportsController's scopeFor().
function scopeFor(userProfile: HospitalUserProfile): string | undefined {
  return userProfile.role === 'doctor' ? userProfile.userId : undefined;
}

@Controller('hospitals/:id/leave-requests')
@UseGuards(HospitalContextGuard)
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @Roles('admin', 'doctor')
  list(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('status') status?: string,
  ) {
    return this.leaveRequestsService.list(hospitalId, { doctorProfileId: scopeFor(userProfile), status });
  }

  @Post('preview-impact')
  @Roles('doctor')
  previewImpact(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { startDate: string; endDate: string },
  ) {
    return this.leaveRequestsService.previewImpact(hospitalId, userProfile.userId, body);
  }

  @Post()
  @Roles('doctor')
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { startDate: string; endDate: string; reason?: string },
  ) {
    return this.leaveRequestsService.create(hospitalId, userProfile, body);
  }

  @Post(':leaveRequestId/nudge')
  @Roles('doctor')
  nudge(
    @Param('id') hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.leaveRequestsService.nudge(hospitalId, leaveRequestId, userProfile);
  }

  @Post(':leaveRequestId/approve')
  @Roles('admin')
  approve(
    @Param('id') hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { note?: string },
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
