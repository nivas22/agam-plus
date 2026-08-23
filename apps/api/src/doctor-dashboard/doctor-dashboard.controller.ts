import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DoctorDashboardService } from './doctor-dashboard.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ApiError } from '../common/errors/api-error';

// A doctor caller always gets their own data. An admin isn't scoped by a
// :doctorId URL param here (there's no per-doctor route segment), so they
// must say which doctor via ?doctorId= instead.
function resolveDoctorProfileId(userProfile: HospitalUserProfile, doctorId?: string): string {
  if (userProfile.role === 'doctor') return userProfile.userId;
  if (!doctorId) throw ApiError.badRequest('doctorId is required');
  return doctorId;
}

@Controller('hospitals/:id/doctor-dashboard')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor')
export class DoctorDashboardController {
  constructor(private readonly doctorDashboardService: DoctorDashboardService) {}

  @Get('pending')
  getPending(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.doctorDashboardService.getPending(hospitalId, resolveDoctorProfileId(userProfile, doctorId));
  }

  @Get('follow-ups')
  getFollowUpsDue(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('doctorId') doctorId?: string,
    @Query('days') days?: string,
  ) {
    return this.doctorDashboardService.getFollowUpsDue(
      hospitalId,
      resolveDoctorProfileId(userProfile, doctorId),
      days ? parseInt(days, 10) : 7,
    );
  }

  @Get('week-overview')
  getWeekOverview(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('startDate') startDate: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.doctorDashboardService.getWeekOverview(
      hospitalId,
      resolveDoctorProfileId(userProfile, doctorId),
      startDate,
    );
  }

  @Get('practice-stats')
  getPracticeStats(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('month') month: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.doctorDashboardService.getPracticeStats(
      hospitalId,
      resolveDoctorProfileId(userProfile, doctorId),
      month,
    );
  }

  @Get('yesterday-summary')
  getYesterdaySummary(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.doctorDashboardService.getYesterdaySummary(
      hospitalId,
      resolveDoctorProfileId(userProfile, doctorId),
    );
  }
}
