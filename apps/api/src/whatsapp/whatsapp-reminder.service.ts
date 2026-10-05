import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WhatsappService } from './whatsapp.service';
import { WhatsappConfigRepository } from '../repositories/whatsapp-config.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { PlatformFeatureCatalogRepository } from '../repositories/platform-feature-catalog.repository';
import { HOSPITAL_MODULE } from '../constants';
import { isHospitalModuleEnabled } from '../hospitals/hospital-modules.util';
import {
  WA_REMINDER_HOURS_BEFORE,
  WA_REMINDER_WINDOW_MINUTES,
} from './whatsapp.constants';

// Appointment date/time are stored as separate ISO strings, not one sortable
// timestamp (see appointment.schema.ts), so eligibility is a two-step check:
// a date-range query narrows candidates, then each one's combined date+time
// is compared precisely against the reminder window in memory.
@Injectable()
export class WhatsappReminderService {
  private readonly logger = new Logger(WhatsappReminderService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly featureCatalogRepository: PlatformFeatureCatalogRepository,
  ) {}

  @Cron('*/15 * * * *')
  async sendDueReminders() {
    const hospitals = await this.whatsappConfigRepository.getAllConnected();

    for (const config of hospitals as any[]) {
      try {
        // The WhatsApp module can be off independent of the hospital's own
        // connect/disconnect toggle (plan or Settings > Features) — honor
        // that here too, since this cron runs outside any per-request guard.
        const [subscription, hospital, catalog] = await Promise.all([
          this.subscriptionRepository.getByHospitalId(config.hospitalId),
          this.hospitalRepository.getHospitalById(config.hospitalId),
          this.featureCatalogRepository.getCatalog(),
        ]);
        if (
          !isHospitalModuleEnabled(
            HOSPITAL_MODULE.WHATSAPP,
            (hospital as any)?.modules,
            subscription?.features,
            catalog.moduleStatus,
          )
        ) {
          continue;
        }

        await this.sendRemindersForHospital(config.hospitalId);
      } catch (error) {
        this.logger.error(
          `Reminder sweep failed for hospital ${config.hospitalId}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async sendRemindersForHospital(hospitalId: string) {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() +
        (WA_REMINDER_HOURS_BEFORE * 60 - WA_REMINDER_WINDOW_MINUTES) * 60000,
    );
    const windowEnd = new Date(
      now.getTime() +
        (WA_REMINDER_HOURS_BEFORE * 60 + WA_REMINDER_WINDOW_MINUTES) * 60000,
    );

    const candidates = await this.appointmentRepository.getAppointmentsNeedingReminder(
      hospitalId,
      this.toISODate(windowStart),
      this.toISODate(windowEnd),
    );

    for (const appt of candidates as any[]) {
      const when = this.combineDateTime(appt.date, appt.time);
      if (!when || when < windowStart || when > windowEnd) continue;

      const sent = await this.whatsappService.sendText(
        hospitalId,
        appt.patientPhone,
        `Reminder: you have an appointment with ${appt.doctorName || 'the doctor'} on ${this.formatDate(appt.date)} at ${appt.time}. Message us here if you need to reschedule or cancel.`,
      );

      // Stamp even on a send failure (no WhatsApp config change mid-flight,
      // token expiry, etc.) — retrying every 15 minutes for a hard failure
      // would spam the same appointment forever rather than surfacing once.
      await this.appointmentRepository.updateAppointment(appt.id, {
        reminderSentAt: new Date(),
      });

      if (!sent) {
        this.logger.warn(
          `Reminder send failed for appointment ${appt.id} (hospital ${hospitalId})`,
        );
      }
    }
  }

  private toISODate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  private combineDateTime(date?: string, time?: string): Date | null {
    if (!date || !time) return null;
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    if ([y, m, d, h, min].some((n) => Number.isNaN(n))) return null;
    return new Date(y, m - 1, d, h, min);
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
