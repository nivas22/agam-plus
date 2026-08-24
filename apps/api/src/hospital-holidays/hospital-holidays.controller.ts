import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { HospitalHolidaysService } from './hospital-holidays.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createHospitalHolidaySchema,
  updateHospitalHolidaySchema,
  previewHolidayImpactSchema,
  holidayStatusSchema,
  generateHolidayRepeatsSchema,
  importTnHolidayListSchema,
  applyHolidayResolutionsSchema,
} from '../common/validation/schemas';

// Read access is broad — every role that books/manages appointments needs to
// see the calendar. Mutations are admin-only, same as the rest of Settings.
@Controller('hospitals/:id/hospital-holidays')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor', 'front_desk', 'nurse', 'accountant')
export class HospitalHolidaysController {
  constructor(private readonly hospitalHolidaysService: HospitalHolidaysService) {}

  @Get()
  list(@Param('id') hospitalId: string, @Query('year') year?: string) {
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.hospitalHolidaysService.listByYear(hospitalId, targetYear);
  }

  @Post('preview-impact')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(previewHolidayImpactSchema))
  previewImpact(@Param('id') hospitalId: string, @Body() body: any) {
    return this.hospitalHolidaysService.previewImpact(hospitalId, body);
  }

  @Post()
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(createHospitalHolidaySchema))
  create(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.hospitalHolidaysService.createHoliday(hospitalId, userProfile, body);
  }

  @Post(':holidayId/apply-resolutions')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(applyHolidayResolutionsSchema))
  applyResolutions(
    @Param('id') hospitalId: string,
    @Param('holidayId') holidayId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { resolutions: any[] },
  ) {
    return this.hospitalHolidaysService.reconcileExistingHoliday(
      hospitalId,
      holidayId,
      userProfile,
      body.resolutions,
    );
  }

  @Put(':holidayId')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(updateHospitalHolidaySchema))
  update(
    @Param('id') hospitalId: string,
    @Param('holidayId') holidayId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.hospitalHolidaysService.updateHoliday(hospitalId, holidayId, userProfile, body);
  }

  @Patch(':holidayId/status')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(holidayStatusSchema))
  setStatus(
    @Param('id') hospitalId: string,
    @Param('holidayId') holidayId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { status: 'active' | 'removed' },
  ) {
    return this.hospitalHolidaysService.setStatus(hospitalId, holidayId, userProfile, body.status);
  }

  @Post('generate-repeats')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(generateHolidayRepeatsSchema))
  generateRepeats(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { year: number },
  ) {
    return this.hospitalHolidaysService.generateRepeats(hospitalId, userProfile, body.year);
  }

  @Post('import-tn-list')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(importTnHolidayListSchema))
  importTnList(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { year: number },
  ) {
    return this.hospitalHolidaysService.importTnList(hospitalId, userProfile, body.year);
  }
}
