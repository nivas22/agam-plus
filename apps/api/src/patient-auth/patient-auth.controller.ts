import { Body, Controller, Get, Post, UseGuards, UsePipes } from '@nestjs/common';
import { PatientAuthService } from './patient-auth.service';
import { Public } from '../auth/decorators/public.decorator';
import { PatientAuthGuard } from './guards/patient-auth.guard';
import { CurrentPatientAccount } from './decorators/current-patient-account.decorator';
import type { PatientAccountContext } from './decorators/current-patient-account.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { requestOtpSchema, verifyOtpSchema } from '../common/validation/schemas';

@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Public()
  @Post('otp/request')
  @UsePipes(new ZodValidationPipe(requestOtpSchema))
  requestOtp(@Body() body: { phone: string }) {
    return this.patientAuthService.requestOtp(body.phone);
  }

  @Public()
  @Post('otp/verify')
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  verifyOtp(@Body() body: { phone: string; otp: string }) {
    return this.patientAuthService.verifyOtp(body.phone, body.otp);
  }

  // @Public() bypasses the global JwtAuthGuard (which only understands staff
  // tokens and would otherwise reject a patient-scoped one before it ever
  // reaches PatientAuthGuard) — PatientAuthGuard performs the real auth here.
  @Public()
  @Get('me/records')
  @UseGuards(PatientAuthGuard)
  getMyRecords(@CurrentPatientAccount() account: PatientAccountContext) {
    return this.patientAuthService.getMyRecords(account.id);
  }
}
