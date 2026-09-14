import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappEnquiriesService } from './whatsapp-enquiries.service';
import { HospitalContextGuard } from '../auth/guards/hospital-context.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentHospitalUser } from '../auth/decorators/current-user.decorator';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  connectOwnWhatsappSchema,
  whatsappEnabledSchema,
} from '../common/validation/schemas';

// Hospitals can see their number and switch it on or off. Which number they
// get is assigned by a platform admin, since the numbers all live on one
// platform-owned WhatsApp Business Account.
@Controller('hospitals/:id/whatsapp')
@UseGuards(HospitalContextGuard)
@Roles('admin')
export class WhatsappSettingsController {
  constructor(
    private readonly whatsappSettingsService: WhatsappSettingsService,
    private readonly whatsappEnquiriesService: WhatsappEnquiriesService,
  ) {}

  @Get()
  getStatus(@Param('id') hospitalId: string) {
    return this.whatsappSettingsService.getStatus(hospitalId);
  }

  @Post('connect')
  @UsePipes(new ZodValidationPipe(connectOwnWhatsappSchema))
  connectOwnAccount(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: any,
  ) {
    return this.whatsappSettingsService.connectOwnAccount(
      hospitalId,
      userProfile,
      body,
    );
  }

  // Removes the number and its stored credentials. "enabled" only pauses.
  @Post('disconnect')
  disconnect(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.whatsappSettingsService.disconnect(hospitalId, userProfile);
  }

  @Patch('enabled')
  @UsePipes(new ZodValidationPipe(whatsappEnabledSchema))
  setEnabled(
    @Param('id') hospitalId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
    @Body() body: { enabled: boolean },
  ) {
    return this.whatsappSettingsService.setEnabled(
      hospitalId,
      userProfile,
      body.enabled,
    );
  }

  @Get('enquiries')
  @Roles('admin', 'front_desk')
  listEnquiries(
    @Param('id') hospitalId: string,
    @Query('status') status?: string,
  ) {
    return this.whatsappEnquiriesService.list(hospitalId, status);
  }

  @Patch('enquiries/:enquiryId/resolve')
  @Roles('admin', 'front_desk')
  resolveEnquiry(
    @Param('id') hospitalId: string,
    @Param('enquiryId') enquiryId: string,
    @CurrentHospitalUser() userProfile: HospitalUserProfile,
  ) {
    return this.whatsappEnquiriesService.resolve(
      hospitalId,
      enquiryId,
      userProfile,
    );
  }
}
