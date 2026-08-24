import { Body, Controller, Get, Param, Patch, Put, UseGuards, UsePipes } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { savePrescriptionSchema, prescriptionStatusSchema } from '../common/validation/schemas';

// Read access is broad (the visit-record card needs it for any clinical
// role); writing/signing is admin/doctor only, gated by write_prescription.
@Controller('hospitals/:id/appointments/:appointmentId/prescription')
@UseGuards(HospitalContextGuard, PermissionGuard)
@Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  getOne(@Param('id') hospitalId: string, @Param('appointmentId') appointmentId: string) {
    return this.prescriptionsService.getPrescription(hospitalId, appointmentId);
  }

  @Put()
  @Roles('admin', 'doctor')
  @RequirePermission('write_prescription')
  @UsePipes(new ZodValidationPipe(savePrescriptionSchema))
  save(
    @Param('id') hospitalId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.prescriptionsService.save(hospitalId, appointmentId, userProfile, body);
  }

  @Patch('status')
  @Roles('admin', 'doctor')
  @RequirePermission('write_prescription')
  @UsePipes(new ZodValidationPipe(prescriptionStatusSchema))
  setStatus(
    @Param('id') hospitalId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'draft' | 'signed' },
  ) {
    return this.prescriptionsService.setStatus(hospitalId, appointmentId, userProfile, body.status);
  }
}
