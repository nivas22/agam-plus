import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createDoctorSchema, updateDoctorAvailabilitySchema } from '../common/validation/schemas';

@Controller('hospitals/:id/doctors')
@UseGuards(HospitalContextGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @Roles('admin', 'doctor')
  list(
    @Param('id') hospitalId: string,
    @Query()
    query: {
      search?: string;
      status?: string;
      specialization?: string;
      joinedFrom?: string;
      joinedTo?: string;
      sortBy?: 'name' | 'joinedAt';
      sortOrder?: 'asc' | 'desc';
      page?: string;
      limit?: string;
    },
  ) {
    return this.doctorsService.getDoctors(hospitalId, query);
  }

  @Post()
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(createDoctorSchema))
  create(@Param('id') hospitalId: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, any>) {
    return this.doctorsService.createDoctor(hospitalId, user.uid, body as any);
  }

  @Get('profile/:userId')
  @Roles('admin', 'doctor')
  getProfileByUserId(@Param('id') hospitalId: string, @Param('userId') userId: string) {
    return this.doctorsService.getDoctorProfileByUserId(hospitalId, userId);
  }

  @Get(':doctorId')
  @Roles('admin', 'doctor')
  getOne(@Param('id') hospitalId: string, @Param('doctorId') doctorId: string) {
    return this.doctorsService.getDoctorById(hospitalId, doctorId);
  }

  @Put(':doctorId')
  @Roles('admin', 'doctor')
  update(
    @Param('id') hospitalId: string,
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: Record<string, any>,
  ) {
    return this.doctorsService.updateDoctor(hospitalId, doctorId, body, user.uid);
  }

  @Delete(':doctorId')
  @Roles('admin')
  remove(@Param('id') hospitalId: string, @Param('doctorId') doctorId: string) {
    return this.doctorsService.deleteDoctor(hospitalId, doctorId);
  }

  @Patch(':doctorId/status')
  @Roles('admin')
  updateStatus(
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { status: string },
  ) {
    return this.doctorsService.updateDoctorStatus(doctorId, body.status, user.userId);
  }

  @Get(':doctorId/availability')
  @Roles('admin', 'doctor')
  getAvailability(
    @Param('id') hospitalId: string,
    @Param('doctorId') doctorId: string,
    @Query('date') date?: string,
  ) {
    return this.doctorsService.getAvailability(hospitalId, doctorId, date);
  }

  @Post(':doctorId/availability')
  @Roles('admin', 'doctor')
  @UsePipes(new ZodValidationPipe(updateDoctorAvailabilitySchema))
  saveAvailability(
    @Param('id') hospitalId: string,
    @Param('doctorId') doctorId: string,
    @Body() body: { availability: any[]; appointmentDuration?: number },
  ) {
    return this.doctorsService.saveAvailability(hospitalId, doctorId, body);
  }

  @Get(':doctorId/next-availability')
  @Roles('admin', 'doctor')
  getNextAvailability(
    @Param('id') hospitalId: string,
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
    @Query('preferredTime') preferredTime?: string,
  ) {
    return this.doctorsService.getNextAvailability(hospitalId, doctorId, date, preferredTime);
  }
}
