import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { loginSchema, switchHospitalSchema } from '../common/validation/schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: { idToken: string }) {
    return this.authService.login(body.idToken);
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
  logout() {
    return this.authService.logout();
  }
}
