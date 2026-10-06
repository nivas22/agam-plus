import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  addHospitalAdminSchema,
  setPlatformAdminSchema,
  setSubscriptionCancelledSchema,
  setSubscriptionExemptSchema,
  setSubscriptionFeaturesSchema,
  updateFeatureCatalogSchema,
  updateSubscriptionPlanConfigSchema,
} from '../common/validation/schemas';
import { HOSPITAL_MODULE } from '../constants';

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

  @Post('subscriptions/invoices/:invoiceId/confirm-payment')
  confirmSubscriptionPayment(@Param('invoiceId') invoiceId: string, @CurrentUser() user: JwtUser) {
    return this.platformAdminService.confirmSubscriptionPayment(invoiceId, { userId: user.userId, name: user.name });
  }

  @Get('hospitals/:id/subscription')
  getSubscriptionSummary(@Param('id') id: string) {
    return this.platformAdminService.getSubscriptionSummary(id);
  }

  @Patch('hospitals/:id/subscription/exempt')
  @UsePipes(new ZodValidationPipe(setSubscriptionExemptSchema))
  setSubscriptionExempt(@Param('id') id: string, @CurrentUser() user: JwtUser, @Body() body: { exempt: boolean }) {
    return this.platformAdminService.setSubscriptionExempt(id, body.exempt, { userId: user.userId, name: user.name });
  }

  @Patch('hospitals/:id/subscription/cancel')
  @UsePipes(new ZodValidationPipe(setSubscriptionCancelledSchema))
  setSubscriptionCancelled(@Param('id') id: string, @CurrentUser() user: JwtUser, @Body() body: { cancelled: boolean }) {
    return this.platformAdminService.setSubscriptionCancelled(id, body.cancelled, {
      userId: user.userId,
      name: user.name,
    });
  }

  @Patch('hospitals/:id/subscription/features')
  @UsePipes(new ZodValidationPipe(setSubscriptionFeaturesSchema))
  setSubscriptionFeatures(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { features: Partial<Record<HOSPITAL_MODULE, boolean>> },
  ) {
    return this.platformAdminService.setSubscriptionFeatures(id, body.features, {
      userId: user.userId,
      name: user.name,
    });
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.platformAdminService.listSubscriptions();
  }

  @Get('subscription-plan-config')
  getPlanConfig() {
    return this.platformAdminService.getPlanConfig();
  }

  @Put('subscription-plan-config')
  @UsePipes(new ZodValidationPipe(updateSubscriptionPlanConfigSchema))
  updatePlanConfig(@CurrentUser() user: JwtUser, @Body() body: Record<string, any>) {
    return this.platformAdminService.updatePlanConfig(body, user.userId);
  }

  @Get('feature-catalog')
  getFeatureCatalog() {
    return this.platformAdminService.getFeatureCatalog();
  }

  @Put('feature-catalog')
  @UsePipes(new ZodValidationPipe(updateFeatureCatalogSchema))
  updateFeatureCatalog(@CurrentUser() user: JwtUser, @Body() body: Record<string, any>) {
    return this.platformAdminService.updateFeatureCatalog(body, user.userId);
  }

  @Get('demo-requests')
  listDemoRequests(@Query('status') status?: string) {
    return this.platformAdminService.listDemoRequests(status);
  }

  @Patch('demo-requests/:id/contacted')
  markDemoRequestContacted(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.platformAdminService.markDemoRequestContacted(id, { userId: user.userId });
  }
}
