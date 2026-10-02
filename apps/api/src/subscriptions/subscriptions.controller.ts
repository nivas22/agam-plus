import { Body, Controller, Get, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { changeSubscriptionPlanSchema, submitSubscriptionPaymentSchema } from '../common/validation/schemas';

@Controller('hospitals/:id/subscription')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  getBillingSummary(@Param('id') hospitalId: string) {
    return this.subscriptionsService.getBillingSummary(hospitalId);
  }

  @Put('plan')
  @UsePipes(new ZodValidationPipe(changeSubscriptionPlanSchema))
  changePlan(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { billingCycle: string },
  ) {
    return this.subscriptionsService.changePlan(hospitalId, body.billingCycle, {
      userId: userProfile.userId,
      name: userProfile.name,
      role: userProfile.role,
      isOwner: !!userProfile.isOwner,
    });
  }

  @Post('invoices/:invoiceId/submit-payment')
  @UsePipes(new ZodValidationPipe(submitSubscriptionPaymentSchema))
  submitPayment(
    @Param('invoiceId') invoiceId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { reference: string },
  ) {
    return this.subscriptionsService.submitManualPayment(invoiceId, {
      reference: body.reference,
      userId: userProfile.userId,
      name: userProfile.name,
      role: userProfile.role,
    });
  }
}
