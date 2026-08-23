import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createMedicineSchema,
  updateMedicineSchema,
  medicineStatusSchema,
} from '../common/validation/schemas';

// Read access is broad — the prescription writer (any clinical role) needs
// the live catalog. Mutations are admin-only, same as the charge catalog.
@Controller('hospitals/:id/medicines')
@UseGuards(HospitalContextGuard, PermissionGuard)
@Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  list(
    @Param('id') hospitalId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.medicinesService.listItems(hospitalId, { status, search });
  }

  @Get(':medicineId')
  getOne(@Param('id') hospitalId: string, @Param('medicineId') medicineId: string) {
    return this.medicinesService.getItem(hospitalId, medicineId);
  }

  @Post()
  @Roles('admin')
  @RequirePermission('manage_medicine_catalog')
  @UsePipes(new ZodValidationPipe(createMedicineSchema))
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.medicinesService.createItem(hospitalId, userProfile, body);
  }

  @Put(':medicineId')
  @Roles('admin')
  @RequirePermission('manage_medicine_catalog')
  @UsePipes(new ZodValidationPipe(updateMedicineSchema))
  update(
    @Param('id') hospitalId: string,
    @Param('medicineId') medicineId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.medicinesService.updateItem(hospitalId, medicineId, userProfile, body);
  }

  @Patch(':medicineId/status')
  @Roles('admin')
  @RequirePermission('manage_medicine_catalog')
  @UsePipes(new ZodValidationPipe(medicineStatusSchema))
  setStatus(
    @Param('id') hospitalId: string,
    @Param('medicineId') medicineId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'active' | 'archived' },
  ) {
    return this.medicinesService.setStatus(hospitalId, medicineId, userProfile, body.status);
  }
}
