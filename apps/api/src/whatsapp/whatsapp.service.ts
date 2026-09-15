import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappConfigRepository } from '../repositories/whatsapp-config.repository';
import { graphApiBase, WA_MAX_LIST_ROWS } from './whatsapp.constants';

export interface WaButton {
  id: string;
  title: string;
}

export interface WaListRow {
  id: string;
  title: string;
  description?: string;
}

// Sends on behalf of one hospital's connected number. Mirrors EmailService:
// never throws at the caller, returns false and logs on failure, and falls
// back to logging when nothing is configured (local dev).
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
  ) {}

  async sendText(hospitalId: string, to: string, body: string) {
    return this.send(hospitalId, to, { type: 'text', text: { body } });
  }

  async sendButtons(
    hospitalId: string,
    to: string,
    bodyText: string,
    buttons: WaButton[],
  ) {
    return this.send(hospitalId, to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          // Meta rejects the message outright above 3 buttons.
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: this.truncate(b.title, 20) },
          })),
        },
      },
    });
  }

  async sendList(
    hospitalId: string,
    to: string,
    bodyText: string,
    buttonLabel: string,
    rows: WaListRow[],
  ) {
    return this.send(hospitalId, to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: this.truncate(buttonLabel, 20),
          sections: [
            {
              title: this.truncate(buttonLabel, 24),
              rows: rows.slice(0, WA_MAX_LIST_ROWS).map((r) => ({
                id: r.id,
                title: this.truncate(r.title, 24),
                ...(r.description
                  ? { description: this.truncate(r.description, 72) }
                  : {}),
              })),
            },
          ],
        },
      },
    });
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  private async send(
    hospitalId: string,
    to: string,
    payload: Record<string, any>,
  ): Promise<boolean> {
    try {
      const config =
        await this.whatsappConfigRepository.getByHospitalId(hospitalId);
      const accessToken =
        await this.whatsappConfigRepository.getDecryptedAccessToken(hospitalId);

      if (!config?.connected || !accessToken) {
        this.logger.log(
          `WhatsApp not connected for hospital ${hospitalId} — message to ${to} not sent: ${JSON.stringify(payload)}`,
        );
        return false;
      }

      const response = await fetch(
        `${graphApiBase(this.config)}/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            ...payload,
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Failed to send WhatsApp message: ${await response.text()}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', error as Error);
      return false;
    }
  }
}
