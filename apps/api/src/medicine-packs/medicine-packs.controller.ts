import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { MedicinePacksService } from './medicine-packs.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createMedicinePackSchema,
  updateMedicinePackSchema,
  medicinePackStatusSchema,
} from '../common/validation/schemas';

// Read access is broad — the prescription writer's "Packs" quick-start (any
// clinical role) needs the live list. Mutations are admin-only, same as the
// medicine and charge catalogs.
@Controller('hospitals/:id/medicine-packs')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
export class MedicinePacksController {
  constructor(private readonly medicinePacksService: MedicinePacksService) {}

  @Get()
  list(
    @Param('id') hospitalId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.medicinePacksService.listItems(hospitalId, { status, search });
  }

  @Get(':packId')
  getOne(@Param('id') hospitalId: string, @Param('packId') packId: string) {
    return this.medicinePacksService.getItem(hospitalId, packId);
  }

  @Post()
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(createMedicinePackSchema))
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.medicinePacksService.createItem(hospitalId, userProfile, body);
  }

  @Put(':packId')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(updateMedicinePackSchema))
  update(
    @Param('id') hospitalId: string,
    @Param('packId') packId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.medicinePacksService.updateItem(hospitalId, packId, userProfile, body);
  }

  @Patch(':packId/status')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(medicinePackStatusSchema))
  setStatus(
    @Param('id') hospitalId: string,
    @Param('packId') packId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'active' | 'archived' },
  ) {
    return this.medicinePacksService.setStatus(hospitalId, packId, userProfile, body.status);
  }
}
