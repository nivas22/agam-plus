import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser, HospitalUserProfile } from '../auth/decorators/current-user.decorator';

@Controller('hospitals/:id/patients')
@UseGuards(HospitalContextGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles('admin', 'doctor')
  list(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.listPatients(
      hospitalId,
      userProfile.userId,
      status || undefined,
      parseInt(page || '1', 10),
      parseInt(limit || '10', 10),
    );
  }

  @Post()
  @Roles('admin')
  create(@Param('id') hospitalId: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, any>) {
    return this.patientsService.createPatient(hospitalId, user, body);
  }

  @Get(':patientId')
  @Roles('admin', 'doctor')
  getOne(@Param('id') hospitalId: string, @Param('patientId') patientId: string) {
    return this.patientsService.getPatient(hospitalId, patientId);
  }

  @Put(':patientId')
  @Roles('admin')
  update(
    @Param('id') hospitalId: string,
    @Param('patientId') patientId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.patientsService.updatePatient(hospitalId, patientId, body);
  }

  @Delete(':patientId')
  @Roles('admin')
  remove(
    @Param('id') hospitalId: string,
    @Param('patientId') patientId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.patientsService.deletePatient(hospitalId, patientId, userProfile.userId);
  }
}
