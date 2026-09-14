import { ConfigService } from '@nestjs/config';

const DEFAULT_API_VERSION = 'v21.0';

// WHATSAPP_GRAPH_BASE_URL points the client at a mock instead of Meta, which
// is the only way to exercise the bot locally — Meta will not deliver to a
// developer machine.
export function graphApiBase(config: ConfigService): string {
  const override = config.get<string>('WHATSAPP_GRAPH_BASE_URL');
  if (override) return override.replace(/\/$/, '');
  const version =
    config.get<string>('WHATSAPP_API_VERSION') || DEFAULT_API_VERSION;
  return `https://graph.facebook.com/${version}`;
}

// Option ids used in the interactive menus. They come back verbatim as the
// button/list reply id, so they double as the conversation's input alphabet.
export const WA_ACTION = {
  BOOK: 'book',
  ENQUIRY: 'enquiry',
  CONFIRM_YES: 'confirm_yes',
  CONFIRM_NO: 'confirm_no',
} as const;

export const WA_PREFIX = {
  DOCTOR: 'doctor:',
  DATE: 'date:',
  TIME: 'time:',
} as const;

// Meta caps interactive lists at 10 rows and button messages at 3 buttons.
export const WA_MAX_LIST_ROWS = 10;

// How many days ahead the bot offers when picking an appointment date.
export const WA_DATE_CHOICES = 7;
