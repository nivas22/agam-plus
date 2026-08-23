import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentHospitalUser,
} from '../auth/decorators/current-user.decorator';
import type {
  JwtUser,
  HospitalUserProfile,
} from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  extendPackageSchema,
  previewPackageScheduleSchema,
  sellPackageSchema,
} from '../common/validation/schemas';
import type {
  PreviewPackageScheduleBody,
  SellPackageBody,
  ExtendPackageBody,
} from './packages.types';

@Controller('hospitals/:id/packages')
@UseGuards(HospitalContextGuard, PermissionGuard)
@Roles('admin', 'doctor', 'front_desk')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  getPackages(
    @Param('id') hospitalId: string,
    @Query('patientId') patientId?: string,
    @Query('doctorProfileId') doctorProfileId?: string,
  ) {
    return this.packagesService.getPackages(hospitalId, {
      patientId,
      doctorProfileId,
    });
  }

  @Get('stats')
  getPackageStats(@Param('id') hospitalId: string) {
    return this.packagesService.getPackageStats(hospitalId);
  }

  @Get(':packageId')
  getPackageLedger(
    @Param('id') hospitalId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.packagesService.getPackageLedger(hospitalId, packageId);
  }

  @Patch(':packageId/extend')
  @RequirePermission('extend_expired_package')
  extendPackage(
    @Param('id') hospitalId: string,
    @Param('packageId') packageId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(extendPackageSchema)) body: ExtendPackageBody,
  ) {
    return this.packagesService.extendPackage(hospitalId, packageId, userProfile, body);
  }

  @Patch(':packageId/refund')
  refundPackage(
    @Param('id') hospitalId: string,
    @Param('packageId') packageId: string,
    @CurrentUser() user: JwtUser,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.packagesService.refundPackage(
      hospitalId,
      packageId,
      user,
      userProfile,
    );
  }

  @Post('preview-schedule')
  previewSchedule(
    @Param('id') hospitalId: string,
    @Body(new ZodValidationPipe(previewPackageScheduleSchema))
    body: PreviewPackageScheduleBody,
  ) {
    return this.packagesService.previewSchedule(hospitalId, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('sell_package')
  sellPackage(
    @Param('id') hospitalId: string,
    @CurrentUser() user: JwtUser,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(sellPackageSchema)) body: SellPackageBody,
  ) {
    return this.packagesService.sellPackage(
      hospitalId,
      user,
      userProfile,
      body,
    );
  }
}
