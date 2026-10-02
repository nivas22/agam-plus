import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SendSmsParams {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger('SmsService');

  constructor(private readonly config: ConfigService) {}

  /**
   * Placeholder send — logs in development (this is how you read an OTP
   * during testing, the API response never includes it). Wire up a real
   * provider (Twilio, MSG91, etc.) via SMS_PROVIDER_API_KEY when ready.
   */
  async sendSms({ to, message }: SendSmsParams): Promise<boolean> {
    try {
      const providerApiKey = this.config.get<string>('SMS_PROVIDER_API_KEY');

      if (providerApiKey) {
        this.logger.warn(
          'SMS_PROVIDER_API_KEY is set but no provider integration is wired up yet — falling back to logging.',
        );
      }

      this.logger.log('📱 SMS would be sent:');
      this.logger.log(`To: ${to}`);
      this.logger.log(`Message: ${message}`);

      return true;
    } catch (error) {
      this.logger.error('Error sending SMS:', error as Error);
      return false;
    }
  }
}
