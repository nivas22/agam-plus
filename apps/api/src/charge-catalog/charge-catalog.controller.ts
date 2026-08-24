import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ChargeCatalogService } from './charge-catalog.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createChargeCatalogItemSchema,
  updateChargeCatalogItemSchema,
  chargeCatalogStatusSchema,
  bulkReviseChargeCatalogSchema,
} from '../common/validation/schemas';

// Read access is broad — the bill line-item picker (any role that can
// complete a visit) needs the live catalog. Mutations are admin-only, same
// as the rest of Settings.
@Controller('hospitals/:id/charge-catalog')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
export class ChargeCatalogController {
  constructor(private readonly chargeCatalogService: ChargeCatalogService) {}

  @Get()
  list(
    @Param('id') hospitalId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.chargeCatalogService.listItems(hospitalId, {
      category,
      status,
      search,
    });
  }

  @Get(':itemId')
  getOne(@Param('id') hospitalId: string, @Param('itemId') itemId: string) {
    return this.chargeCatalogService.getItem(hospitalId, itemId);
  }

  @Post()
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(createChargeCatalogItemSchema))
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.chargeCatalogService.createItem(hospitalId, userProfile, body);
  }

  @Put(':itemId')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(updateChargeCatalogItemSchema))
  update(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.chargeCatalogService.updateItem(
      hospitalId,
      itemId,
      userProfile,
      body,
    );
  }

  @Patch(':itemId/status')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(chargeCatalogStatusSchema))
  setStatus(
    @Param('id') hospitalId: string,
    @Param('itemId') itemId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'active' | 'archived' },
  ) {
    return this.chargeCatalogService.setStatus(
      hospitalId,
      itemId,
      userProfile,
      body.status,
    );
  }

  @Post('bulk-revise')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(bulkReviseChargeCatalogSchema))
  bulkRevise(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.chargeCatalogService.bulkRevise(hospitalId, userProfile, body);
  }
}
