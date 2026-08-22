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
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor')
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
  extendPackage(
    @Param('id') hospitalId: string,
    @Param('packageId') packageId: string,
    @Body(new ZodValidationPipe(extendPackageSchema)) body: ExtendPackageBody,
  ) {
    return this.packagesService.extendPackage(hospitalId, packageId, body);
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
