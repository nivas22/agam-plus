import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappConfigRepository } from '../repositories/whatsapp-config.repository';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import type { InboundMessage } from './whatsapp-conversation.service';

// Meta calls this unauthenticated, so @Public() bypasses the global
// JwtAuthGuard and the X-Hub-Signature-256 HMAC is the actual authentication.
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly conversationService: WhatsappConversationService,
  ) {}

  // Meta's subscription handshake — echo the challenge back verbatim.
  @Public()
  @Get()
  verify(@Query() query: Record<string, string>, @Res() res: Response) {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (
      query['hub.mode'] === 'subscribe' &&
      expected &&
      query['hub.verify_token'] === expected
    ) {
      res.status(200).send(query['hub.challenge']);
      return;
    }
    this.logger.warn('Rejected WhatsApp webhook verification attempt');
    res.sendStatus(403);
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    if (!this.hasValidSignature(req)) {
      this.logger.warn('Rejected WhatsApp webhook with bad signature');
      res.sendStatus(401);
      return;
    }

    // Meta retries and eventually disables webhooks that respond slowly, so
    // acknowledge first and process afterwards.
    res.sendStatus(200);

    try {
      await this.process(req.body);
    } catch (error) {
      this.logger.error('Failed to process WhatsApp webhook', error as Error);
    }
  }

  private hasValidSignature(req: RawBodyRequest<Request>): boolean {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!appSecret) {
      this.logger.error('WHATSAPP_APP_SECRET is not configured');
      return false;
    }

    const header = req.headers['x-hub-signature-256'];
    if (typeof header !== 'string' || !req.rawBody) return false;

    const expected = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(req.rawBody)
      .digest('hex')}`;

    const received = Buffer.from(header);
    const computed = Buffer.from(expected);
    if (received.length !== computed.length) return false;
    return crypto.timingSafeEqual(received, computed);
  }

  private async process(body: any) {
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;
        if (!phoneNumberId || !value?.messages?.length) continue;

        // All hospitals share one webhook URL; the phone number ID is what
        // tells us whose number was messaged.
        const config =
          await this.whatsappConfigRepository.getByPhoneNumberId(phoneNumberId);
        if (!config?.connected) {
          this.logger.warn(
            `Ignoring message for unknown or disconnected number ${phoneNumberId}`,
          );
          continue;
        }

        for (const message of value.messages) {
          const profileName =
            value.contacts?.find((c: any) => c.wa_id === message.from)?.profile
              ?.name ?? '';
          await this.conversationService.handleInboundMessage(
            config.hospitalId,
            message.from,
            profileName,
            this.toInboundMessage(message),
          );
        }
      }
    }
  }

  private toInboundMessage(message: any): InboundMessage {
    if (message.type === 'interactive') {
      const interactive = message.interactive ?? {};
      return {
        optionId:
          interactive.button_reply?.id ?? interactive.list_reply?.id ?? undefined,
      };
    }
    return { text: message.text?.body };
  }
}
