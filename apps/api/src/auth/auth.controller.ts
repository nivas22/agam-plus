import { Body, Controller, Get, Param, Post, Req, UsePipes } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  loginSchema,
  switchHospitalSchema,
  loginPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  requestPasswordOtpSchema,
  verifyPasswordOtpSchema,
} from '../common/validation/schemas';

function clientInfo(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: { idToken: string }, @Req() req: Request) {
    return this.authService.login(body.idToken, clientInfo(req));
  }

  @Public()
  @Post('login-password')
  @UsePipes(new ZodValidationPipe(loginPasswordSchema))
  loginWithPassword(
    @Body() body: { username: string; password: string; keepSignedIn?: boolean },
    @Req() req: Request,
  ) {
    return this.authService.loginWithPassword(body.username, body.password, {
      keepSignedIn: body.keepSignedIn,
      ...clientInfo(req),
    });
  }

  @Public()
  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  forgotPassword(@Body() body: { username: string }) {
    return this.authService.forgotPassword(body.username);
  }

  @Public()
  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Public()
  @Post('password-otp/request')
  @UsePipes(new ZodValidationPipe(requestPasswordOtpSchema))
  requestPasswordOtp(@Body() body: { username: string; channel: 'sms' | 'whatsapp' }) {
    return this.authService.requestPasswordOtp(body.username, body.channel);
  }

  @Public()
  @Post('password-otp/verify')
  @UsePipes(new ZodValidationPipe(verifyPasswordOtpSchema))
  verifyPasswordOtp(@Body() body: { username: string; otp: string }) {
    return this.authService.verifyPasswordOtp(body.username, body.otp);
  }

  @Post('change-password')
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() body: { currentPassword: string; newPassword: string; signOutOthers?: boolean },
  ) {
    return this.authService.changePassword(user, body.currentPassword, body.newPassword, body.signOutOthers);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: JwtUser) {
    return this.authService.listSessions(user);
  }

  @Post('sessions/:id/revoke')
  revokeSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.authService.revokeSession(user, id);
  }

  @Post('sessions/revoke-others')
  revokeOtherSessions(@CurrentUser() user: JwtUser) {
    return this.authService.revokeOtherSessions(user);
  }

  @Get('user')
  getUser(@CurrentUser() user: JwtUser) {
    return this.authService.getMe(user);
  }

  @Get('session')
  getSession(@CurrentUser() user: JwtUser) {
    return this.authService.getSession(user);
  }

  @Post('hospital')
  @UsePipes(new ZodValidationPipe(switchHospitalSchema))
  switchHospital(@CurrentUser() user: JwtUser, @Body() body: { hospitalId: string }) {
    return this.authService.switchHospital(user, body.hospitalId);
  }

  @Post('logout')
  logout(@CurrentUser() user: JwtUser) {
    return this.authService.logout(user);
  }
}
