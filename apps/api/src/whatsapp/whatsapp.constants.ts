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
  CHANGE_DOCTOR: 'change_doctor',
  MY_APPOINTMENTS: 'my_appointments',
  APPT_RESCHEDULE: 'appt_reschedule',
  APPT_CANCEL: 'appt_cancel',
  APPT_CANCEL_YES: 'appt_cancel_yes',
  APPT_CANCEL_NO: 'appt_cancel_no',
  // Recognized anywhere a session is active, same as the "menu" text
  // keyword — a button equivalent for patients who tap rather than type.
  MAIN_MENU: 'main_menu',
} as const;

export const WA_PREFIX = {
  DOCTOR: 'doctor:',
  DATE: 'date:',
  TIME: 'time:',
  APPT: 'appt:',
} as const;

// How long before an appointment its WhatsApp reminder goes out.
export const WA_REMINDER_HOURS_BEFORE = 24;
// Cron runs every 15 minutes, so a candidate within this many minutes of the
// target lead time is "due now" — wide enough that no appointment is missed
// between two runs, narrow enough nothing gets reminded twice.
export const WA_REMINDER_WINDOW_MINUTES = 15;

// Free-text a patient can send at any step to escape a stuck flow instead of
// waiting out the session TTL or re-sending an arbitrary message.
export const WA_RESTART_KEYWORDS = new Set([
  'menu',
  'hi',
  'hello',
  'hey',
  'start',
  'restart',
  'main menu',
]);
export const WA_CANCEL_KEYWORDS = new Set(['cancel', 'stop', 'quit']);

// Meta caps interactive lists at 10 rows and button messages at 3 buttons.
export const WA_MAX_LIST_ROWS = 10;

// How many days ahead the bot offers when picking an appointment date.
export const WA_DATE_CHOICES = 7;
