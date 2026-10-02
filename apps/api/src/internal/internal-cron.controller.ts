import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CronSecretGuard } from '../auth/guards/cron-secret.guard';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WhatsappReminderService } from '../whatsapp/whatsapp-reminder.service';

// Vercel serverless functions have no long-lived process for
// @nestjs/schedule's @Cron timers to tick on — these endpoints are the
// production trigger instead, invoked by Vercel Cron Jobs (see
// apps/api/vercel.json's `crons` entries) rather than the in-memory
// scheduler. The @Cron decorators on the underlying services are left in
// place too, so a traditional long-lived deployment (local `nest start`,
// a non-serverless host) still works without any external trigger.
@Controller('internal/cron')
@Public()
@UseGuards(CronSecretGuard)
export class InternalCronController {
  private readonly logger = new Logger(InternalCronController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly whatsappReminderService: WhatsappReminderService,
  ) {}

  @Get('subscription-renewal')
  async runSubscriptionRenewal() {
    await this.subscriptionsService.runRenewalSweep();
    this.logger.log('Subscription renewal sweep completed');
    return { success: true };
  }

  @Get('whatsapp-reminders')
  async runWhatsappReminders() {
    await this.whatsappReminderService.sendDueReminders();
    this.logger.log('WhatsApp reminder sweep completed');
    return { success: true };
  }
}
