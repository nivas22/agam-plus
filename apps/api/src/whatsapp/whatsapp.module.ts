import { Module } from '@nestjs/common';
import { WhatsappSettingsController } from './whatsapp-settings.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappSettingsService } from './whatsapp-settings.service';
import { WhatsappEnquiriesService } from './whatsapp-enquiries.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappPatientLookupService } from './whatsapp-patient-lookup.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [AuthModule, AuditModule, DoctorsModule, AppointmentsModule],
  controllers: [WhatsappSettingsController, WhatsappWebhookController],
  providers: [
    WhatsappSettingsService,
    WhatsappEnquiriesService,
    WhatsappService,
    WhatsappConversationService,
    WhatsappPatientLookupService,
  ],
  exports: [WhatsappService, WhatsappSettingsService],
})
export class WhatsappModule {}
