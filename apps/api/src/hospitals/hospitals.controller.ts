import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { RequiresModule } from '../auth/decorators/requires-module.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createHospitalSchema,
  requestAccessSchema,
  updateHospitalModulesSchema,
  updateHospitalSpecializationsSchema,
  updatePatientNoteFieldsSchema,
} from '../common/validation/schemas';
import { HOSPITAL_MODULE } from '../constants';
import type { PatientNoteField } from '../constants';

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

  // Read access is broad — everyone who can open the Add/Edit Doctor form
  // needs this list for the specialization dropdown. Mutations are admin-only.
  @Get(':id/specializations')
  @UseGuards(HospitalContextGuard)
  @Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
  getSpecializations(@Param('id') id: string) {
    return this.hospitalsService.getSpecializations(id);
  }

  @Put(':id/specializations')
  @UseGuards(HospitalContextGuard)
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(updateHospitalSpecializationsSchema))
  updateSpecializations(@Param('id') id: string, @Body() body: { specializations: string[] }) {
    return this.hospitalsService.updateSpecializations(id, body.specializations);
  }

  // Which fields the patient Add/Edit form's Notes section collects. Read by
  // everyone who can open that form; configured by admins only.
  @Get(':id/patient-note-fields')
  @UseGuards(HospitalContextGuard)
  @Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
  getPatientNoteFields(@Param('id') id: string) {
    return this.hospitalsService.getPatientNoteFields(id);
  }

  @Put(':id/patient-note-fields')
  @UseGuards(HospitalContextGuard)
  @Roles('admin')
  @RequiresModule(HOSPITAL_MODULE.PATIENT_FIELDS)
  @UsePipes(new ZodValidationPipe(updatePatientNoteFieldsSchema))
  updatePatientNoteFields(@Param('id') id: string, @Body() body: { fields: PatientNoteField[] }) {
    return this.hospitalsService.updatePatientNoteFields(id, body.fields);
  }

  // Settings > Features. Every role reads it (the web app hides switched-off
  // modules from everyone); only admins can flip switches.
  @Get(':id/modules')
  @UseGuards(HospitalContextGuard)
  @Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
  getModules(@Param('id') id: string) {
    return this.hospitalsService.getModules(id);
  }

  @Put(':id/modules')
  @UseGuards(HospitalContextGuard)
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(updateHospitalModulesSchema))
  updateModules(
    @Param('id') id: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { modules: Partial<Record<HOSPITAL_MODULE, boolean>> },
  ) {
    return this.hospitalsService.updateModules(id, body.modules, userProfile);
  }
}
