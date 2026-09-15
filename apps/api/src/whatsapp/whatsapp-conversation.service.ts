import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappPatientLookupService } from './whatsapp-patient-lookup.service';
import { WhatsappSessionRepository } from '../repositories/whatsapp-session.repository';
import { WhatsappEnquiryRepository } from '../repositories/whatsapp-enquiry.repository';
import { DoctorsService } from '../doctors/doctors.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { MEMBERSHIP_STATUS, WHATSAPP_STEP } from '../constants';
import {
  WA_ACTION,
  WA_DATE_CHOICES,
  WA_MAX_LIST_ROWS,
  WA_PREFIX,
} from './whatsapp.constants';

export interface InboundMessage {
  // Button/list reply id when the patient tapped an option, else undefined.
  optionId?: string;
  // Raw text when the patient typed instead.
  text?: string;
}

@Injectable()
export class WhatsappConversationService {
  private readonly logger = new Logger(WhatsappConversationService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly sessionRepository: WhatsappSessionRepository,
    private readonly enquiryRepository: WhatsappEnquiryRepository,
    private readonly patientLookup: WhatsappPatientLookupService,
    private readonly doctorsService: DoctorsService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async handleInboundMessage(
    hospitalId: string,
    fromPhone: string,
    profileName: string,
    message: InboundMessage,
  ) {
    const session = await this.sessionRepository.getActive(hospitalId, fromPhone);

    if (!session) {
      await this.sendMainMenu(hospitalId, fromPhone);
      return;
    }

    switch (session.currentStep) {
      case WHATSAPP_STEP.MAIN_MENU:
        return this.handleMainMenuChoice(hospitalId, fromPhone, message);
      case WHATSAPP_STEP.CHOOSE_DOCTOR:
        return this.handleDoctorChoice(hospitalId, fromPhone, message);
      case WHATSAPP_STEP.CHOOSE_DATE:
        return this.handleDateChoice(hospitalId, fromPhone, session, message);
      case WHATSAPP_STEP.CHOOSE_TIME:
        return this.handleTimeChoice(hospitalId, fromPhone, session, message);
      case WHATSAPP_STEP.CONFIRM:
        return this.handleConfirm(
          hospitalId,
          fromPhone,
          profileName,
          session,
          message,
        );
      case WHATSAPP_STEP.ENQUIRY_CAPTURE:
        return this.handleEnquiry(hospitalId, fromPhone, profileName, message);
      default:
        return this.sendMainMenu(hospitalId, fromPhone);
    }
  }

  // -- steps --

  private async sendMainMenu(hospitalId: string, fromPhone: string) {
    await this.whatsappService.sendButtons(
      hospitalId,
      fromPhone,
      'Hello! How can we help you today?',
      [
        { id: WA_ACTION.BOOK, title: 'Book appointment' },
        { id: WA_ACTION.ENQUIRY, title: 'General enquiry' },
      ],
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.MAIN_MENU,
    );
  }

  private async handleMainMenuChoice(
    hospitalId: string,
    fromPhone: string,
    message: InboundMessage,
  ) {
    if (message.optionId === WA_ACTION.BOOK) {
      return this.promptForDoctor(hospitalId, fromPhone);
    }
    if (message.optionId === WA_ACTION.ENQUIRY) {
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'Please type your question and our team will get back to you.',
      );
      await this.sessionRepository.upsertStep(
        hospitalId,
        fromPhone,
        WHATSAPP_STEP.ENQUIRY_CAPTURE,
      );
      return;
    }
    return this.sendMainMenu(hospitalId, fromPhone);
  }

  private async promptForDoctor(hospitalId: string, fromPhone: string) {
    const { doctors } = await this.doctorsService.getDoctors(hospitalId, {
      status: MEMBERSHIP_STATUS.APPROVED,
      limit: String(WA_MAX_LIST_ROWS),
    });
    const bookable = doctors.filter((d: any) => d.isAcceptingBookings);

    if (bookable.length === 0) {
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'Sorry, no doctors are available for online booking right now. Please call the hospital.',
      );
      await this.sessionRepository.clear(hospitalId, fromPhone);
      return;
    }

    await this.whatsappService.sendList(
      hospitalId,
      fromPhone,
      'Which doctor would you like to see?',
      'Choose doctor',
      bookable.map((d: any) => ({
        id: `${WA_PREFIX.DOCTOR}${d.id}`,
        title: d.name,
        description: d.specialization || undefined,
      })),
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.CHOOSE_DOCTOR,
    );
  }

  private async handleDoctorChoice(
    hospitalId: string,
    fromPhone: string,
    message: InboundMessage,
  ) {
    const doctorId = this.stripPrefix(message.optionId, WA_PREFIX.DOCTOR);
    if (!doctorId) return this.promptForDoctor(hospitalId, fromPhone);

    await this.whatsappService.sendList(
      hospitalId,
      fromPhone,
      'Which day works for you?',
      'Choose day',
      this.upcomingDates().map((d) => ({
        id: `${WA_PREFIX.DATE}${d.iso}`,
        title: d.label,
      })),
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.CHOOSE_DATE,
      { doctorProfileId: doctorId },
    );
  }

  private async handleDateChoice(
    hospitalId: string,
    fromPhone: string,
    session: any,
    message: InboundMessage,
  ) {
    const date = this.stripPrefix(message.optionId, WA_PREFIX.DATE);
    const doctorProfileId = session.collectedData?.doctorProfileId;
    if (!date || !doctorProfileId) {
      return this.handleDoctorChoice(hospitalId, fromPhone, {
        optionId: `${WA_PREFIX.DOCTOR}${doctorProfileId ?? ''}`,
      });
    }

    const { availableSlots } = await this.doctorsService.getAvailability(
      hospitalId,
      doctorProfileId,
      date,
    );

    if (!availableSlots || availableSlots.length === 0) {
      await this.whatsappService.sendList(
        hospitalId,
        fromPhone,
        'No slots left that day. Please pick another.',
        'Choose day',
        this.upcomingDates().map((d) => ({
          id: `${WA_PREFIX.DATE}${d.iso}`,
          title: d.label,
        })),
      );
      return;
    }

    await this.whatsappService.sendList(
      hospitalId,
      fromPhone,
      `Available times on ${this.formatDate(date)}:`,
      'Choose time',
      availableSlots.map((s: any) => ({
        id: `${WA_PREFIX.TIME}${s.time}`,
        title: s.time,
      })),
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.CHOOSE_TIME,
      { date },
    );
  }

  private async handleTimeChoice(
    hospitalId: string,
    fromPhone: string,
    session: any,
    message: InboundMessage,
  ) {
    const time = this.stripPrefix(message.optionId, WA_PREFIX.TIME);
    if (!time) {
      return this.handleDateChoice(hospitalId, fromPhone, session, {
        optionId: `${WA_PREFIX.DATE}${session.collectedData?.date ?? ''}`,
      });
    }

    const { date } = session.collectedData ?? {};
    await this.whatsappService.sendButtons(
      hospitalId,
      fromPhone,
      `Confirm your appointment on ${this.formatDate(date)} at ${time}?`,
      [
        { id: WA_ACTION.CONFIRM_YES, title: 'Yes, book it' },
        { id: WA_ACTION.CONFIRM_NO, title: 'Cancel' },
      ],
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.CONFIRM,
      { time },
    );
  }

  private async handleConfirm(
    hospitalId: string,
    fromPhone: string,
    profileName: string,
    session: any,
    message: InboundMessage,
  ) {
    if (message.optionId !== WA_ACTION.CONFIRM_YES) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'No problem — your appointment was not booked.',
      );
      return;
    }

    const { doctorProfileId, date, time } = session.collectedData ?? {};
    if (!doctorProfileId || !date || !time) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      return this.sendMainMenu(hospitalId, fromPhone);
    }

    const { patientId } = await this.patientLookup.findOrCreate(
      hospitalId,
      fromPhone,
      profileName,
    );

    try {
      const appointment =
        await this.appointmentsService.createSelfBookingAppointment({
          hospitalId,
          doctorProfileId,
          patientId,
          date,
          time,
          notes: 'Booked via WhatsApp',
          bookedVia: 'whatsapp',
        });

      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        `Request received for ${appointment.doctorName} on ${this.formatDate(date)} at ${time}. The hospital will confirm shortly.`,
      );
    } catch (error) {
      // Almost always the slot going stale between the menu and the tap.
      this.logger.warn(
        `WhatsApp booking failed for hospital ${hospitalId}: ${(error as Error).message}`,
      );
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'Sorry, that slot was just taken. Let us try again.',
      );
      await this.promptForDoctor(hospitalId, fromPhone);
    }
  }

  private async handleEnquiry(
    hospitalId: string,
    fromPhone: string,
    profileName: string,
    message: InboundMessage,
  ) {
    const text = message.text?.trim();
    if (!text) {
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'Please type your question as a text message.',
      );
      return;
    }

    await this.enquiryRepository.create({
      hospitalId,
      fromPhone,
      patientName: profileName,
      message: text,
    });
    await this.sessionRepository.clear(hospitalId, fromPhone);
    await this.whatsappService.sendText(
      hospitalId,
      fromPhone,
      'Thanks — we have passed this to our team and will reply soon.',
    );
  }

  // -- helpers --

  private stripPrefix(value: string | undefined, prefix: string) {
    if (!value?.startsWith(prefix)) return null;
    return value.slice(prefix.length) || null;
  }

  private upcomingDates() {
    const out: { iso: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < WA_DATE_CHOICES; i++) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + i,
      );
      out.push({ iso: this.toISODate(d), label: this.dateLabel(d, i) });
    }
    return out;
  }

  private toISODate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  private dateLabel(d: Date, offset: number): string {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
