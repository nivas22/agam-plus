import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser, HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createAppointmentSchema, updateAppointmentSchema } from '../common/validation/schemas';
import type { CreateAppointmentBody, UpdateAppointmentBody } from './appointments.types';

@Controller('hospitals/:id/appointments')
@UseGuards(HospitalContextGuard, PermissionGuard)
@Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  getAppointments(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.getAppointments(hospitalId, userProfile, {
      startDate,
      endDate,
      status,
      doctorId,
      patientId,
      limit,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'doctor', 'front_desk', 'nurse')
  @RequirePermission('book_reschedule')
  createAppointment(
    @Param('id') hospitalId: string,
    @CurrentUser() user: JwtUser,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentBody,
  ) {
    return this.appointmentsService.createAppointment(hospitalId, user, userProfile, body);
  }

  @Patch()
  @Roles('admin', 'doctor', 'front_desk', 'nurse')
  updateAppointment(
    @Param('id') hospitalId: string,
    @CurrentUser() user: JwtUser,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentBody,
  ) {
    return this.appointmentsService.updateAppointment(hospitalId, user, userProfile, body);
  }

  @Delete()
  @Roles('admin', 'doctor', 'front_desk')
  @RequirePermission('delete_appointment')
  deleteAppointment(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Query('id') appointmentId: string,
  ) {
    return this.appointmentsService.deleteAppointment(hospitalId, userProfile, appointmentId);
  }
}
