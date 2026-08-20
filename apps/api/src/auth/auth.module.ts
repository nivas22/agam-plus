import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HospitalContextGuard } from './guards/hospital-context.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    HospitalContextGuard,
    PlatformAdminGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [HospitalContextGuard, PlatformAdminGuard],
})
export class AuthModule {}
