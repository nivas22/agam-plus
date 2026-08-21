import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  previewPackageScheduleSchema,
  sellPackageSchema,
} from '../common/validation/schemas';
import type {
  PreviewPackageScheduleBody,
  SellPackageBody,
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
  ) {
    return this.packagesService.getPackages(hospitalId, { patientId });
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
