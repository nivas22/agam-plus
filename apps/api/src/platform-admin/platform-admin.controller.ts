import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UsePipes } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { addHospitalAdminSchema, setPlatformAdminSchema } from '../common/validation/schemas';

@Controller('platform-admin')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get('stats')
  getStats() {
    return this.platformAdminService.getStats();
  }

  @Get('users')
  getUsers() {
    return this.platformAdminService.getAllUsers();
  }

  @Get('hospitals/:id/members')
  getHospitalMembers(@Param('id') id: string) {
    return this.platformAdminService.getHospitalMembers(id);
  }

  @Post('hospitals/:id/members')
  @UsePipes(new ZodValidationPipe(addHospitalAdminSchema))
  addHospitalAdmin(@Param('id') id: string, @CurrentUser() user: JwtUser, @Body() body: { email: string }) {
    return this.platformAdminService.addHospitalAdmin(id, user.userId, body.email);
  }

  @Delete('hospitals/:id/members/:membershipId')
  removeHospitalMember(@Param('id') id: string, @Param('membershipId') membershipId: string) {
    return this.platformAdminService.removeHospitalMember(id, membershipId);
  }

  @Patch('users/:id/platform-admin')
  @UsePipes(new ZodValidationPipe(setPlatformAdminSchema))
  setPlatformAdmin(@Param('id') id: string, @Body() body: { isPlatformAdmin: boolean }) {
    return this.platformAdminService.setPlatformAdmin(id, body.isPlatformAdmin);
  }
}
