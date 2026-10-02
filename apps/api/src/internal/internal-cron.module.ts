import { Module } from '@nestjs/common';
import { InternalCronController } from './internal-cron.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [SubscriptionsModule, WhatsappModule],
  controllers: [InternalCronController],
})
export class InternalCronModule {}
