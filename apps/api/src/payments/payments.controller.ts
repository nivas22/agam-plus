import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
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
  completeVisitSchema,
  updatePaymentSchema,
  closeDaySchema,
} from '../common/validation/schemas';
import type {
  CompleteVisitBody,
  UpdatePaymentBody,
  CloseDayBody,
} from './payments.types';

@Controller('hospitals/:id/payments')
@UseGuards(HospitalContextGuard)
@Roles('admin', 'doctor')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  getPayments(
    @Param('id') hospitalId: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getPayments(hospitalId, {
      status,
      method,
      startDate,
      endDate,
      appointmentId,
      limit,
    });
  }

  @Post()
  completeVisit(
    @Param('id') hospitalId: string,
    @CurrentUser() user: JwtUser,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(completeVisitSchema)) body: CompleteVisitBody,
  ) {
    return this.paymentsService.completeVisit(
      hospitalId,
      user,
      userProfile,
      body,
    );
  }

  @Patch(':paymentId')
  updatePayment(
    @Param('id') hospitalId: string,
    @Param('paymentId') paymentId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(updatePaymentSchema)) body: UpdatePaymentBody,
  ) {
    return this.paymentsService.updatePayment(
      hospitalId,
      userProfile,
      paymentId,
      body,
    );
  }

  @Get('day-close')
  getDayClose(@Param('id') hospitalId: string, @Query('date') date: string) {
    return this.paymentsService.getDayClose(hospitalId, date);
  }

  @Post('day-close')
  closeDay(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body(new ZodValidationPipe(closeDaySchema)) body: CloseDayBody,
  ) {
    return this.paymentsService.closeDay(hospitalId, userProfile, body);
  }
}
