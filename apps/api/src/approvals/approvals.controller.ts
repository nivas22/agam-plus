import { Body, Controller, Get, Param, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { approveRequestSchema, declineRequestSchema } from '../common/validation/schemas';

@Controller('hospitals/:id/approvals')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  list(@Param('id') hospitalId: string, @Query('status') status?: string) {
    return this.approvalsService.list(hospitalId, status);
  }

  @Post(':approvalId/approve')
  @UsePipes(new ZodValidationPipe(approveRequestSchema))
  approve(
    @Param('id') hospitalId: string,
    @Param('approvalId') approvalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { pin?: string; note?: string },
  ) {
    return this.approvalsService.approve(hospitalId, approvalId, userProfile, body);
  }

  @Post(':approvalId/decline')
  @UsePipes(new ZodValidationPipe(declineRequestSchema))
  decline(
    @Param('id') hospitalId: string,
    @Param('approvalId') approvalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { note?: string },
  ) {
    return this.approvalsService.decline(hospitalId, approvalId, userProfile, body);
  }
}
