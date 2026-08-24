import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createHospitalSchema, requestAccessSchema } from '../common/validation/schemas';

@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  // Any authenticated user can list hospitals — the request-access flow
  // relies on this to let doctors/staff browse hospitals to join.
  @Get()
  list() {
    return this.hospitalsService.getAllHospitals();
  }

  @Post()
  @UseGuards(PlatformAdminGuard)
  @UsePipes(new ZodValidationPipe(createHospitalSchema))
  create(@CurrentUser() user: JwtUser, @Body() body: Record<string, any>) {
    return this.hospitalsService.createHospital(user, body);
  }

  @Post('request-access')
  @UsePipes(new ZodValidationPipe(requestAccessSchema))
  requestAccess(
    @CurrentUser() user: JwtUser,
    @Body() body: { hospitalId: string; role?: string; message?: string },
  ) {
    return this.hospitalsService.requestAccess(user, body.hospitalId, body.role, body.message);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.hospitalsService.getHospitalById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.hospitalsService.updateHospital(id, body);
  }

  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  delete(@Param('id') id: string) {
    return this.hospitalsService.deleteHospital(id);
  }

  @Get(':id/dashboard')
  @UseGuards(HospitalContextGuard)
  @Roles('admin', 'doctor')
  getDashboard(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.hospitalsService.getDashboard(id, user.userId);
  }

  @Get(':id/pending-count')
  getPendingCount(@Param('id') id: string) {
    return this.hospitalsService.getPendingDoctorCount(id);
  }
}
