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
  WA_CANCEL_KEYWORDS,
  WA_DATE_CHOICES,
  WA_MAX_LIST_ROWS,
  WA_PREFIX,
  WA_RESTART_KEYWORDS,
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
    // Recognized anywhere, regardless of step, so a patient is never stuck
    // waiting out the session TTL to escape a flow (e.g. picked wrong doctor).
    const normalizedText = message.text?.trim().toLowerCase();
    if (normalizedText && WA_RESTART_KEYWORDS.has(normalizedText)) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      return this.sendMainMenu(hospitalId, fromPhone);
    }
    if (normalizedText && WA_CANCEL_KEYWORDS.has(normalizedText)) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        "No problem — we've ended this chat. Type \"menu\" anytime to start again.",
      );
      return;
    }
    // Button equivalent of the "menu" keyword, for screens that offer it as
    // a tap rather than relying on the patient knowing to type it.
    if (message.optionId === WA_ACTION.MAIN_MENU) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      return this.sendMainMenu(hospitalId, fromPhone);
    }

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
        return this.handleEnquiry(
          hospitalId,
          fromPhone,
          profileName,
          session,
          message,
        );
      case WHATSAPP_STEP.MY_APPOINTMENTS:
        return this.handleAppointmentSelection(hospitalId, fromPhone, message);
      case WHATSAPP_STEP.APPOINTMENT_ACTION:
        return this.handleAppointmentAction(
          hospitalId,
          fromPhone,
          session,
          message,
        );
      case WHATSAPP_STEP.CANCEL_CONFIRM:
        return this.handleCancelConfirm(hospitalId, fromPhone, session, message);
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
        { id: WA_ACTION.MY_APPOINTMENTS, title: 'My appointments' },
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
    if (message.optionId === WA_ACTION.MY_APPOINTMENTS) {
      return this.promptMyAppointments(hospitalId, fromPhone);
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

  // -- my appointments (view / cancel / reschedule) --

  private async promptMyAppointments(hospitalId: string, fromPhone: string) {
    const patient = await this.patientLookup.findExisting(hospitalId, fromPhone);
    if (!patient) {
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        "We couldn't find any appointments for this number.",
      );
      return this.sendMainMenu(hospitalId, fromPhone);
    }

    const appointments = await this.appointmentsService.getUpcomingAppointmentsForPatient(
      hospitalId,
      patient.patientId,
      WA_MAX_LIST_ROWS,
    );

    if (appointments.length === 0) {
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'You have no upcoming appointments.',
      );
      return this.sendMainMenu(hospitalId, fromPhone);
    }

    await this.whatsappService.sendList(
      hospitalId,
      fromPhone,
      'Here are your upcoming appointments. Tap one to reschedule or cancel it:',
      'View appointment',
      appointments.map((a: any) => ({
        id: `${WA_PREFIX.APPT}${a.id}`,
        title: `${a.doctorName || 'Doctor'} — ${this.formatDate(a.date)}`,
        description: a.time,
      })),
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.MY_APPOINTMENTS,
      { patientId: patient.patientId },
    );
  }

  private async handleAppointmentSelection(
    hospitalId: string,
    fromPhone: string,
    message: InboundMessage,
  ) {
    const appointmentId = this.stripPrefix(message.optionId, WA_PREFIX.APPT);
    if (!appointmentId) return this.promptMyAppointments(hospitalId, fromPhone);

    await this.whatsappService.sendButtons(
      hospitalId,
      fromPhone,
      'What would you like to do with this appointment?',
      [
        { id: WA_ACTION.APPT_RESCHEDULE, title: 'Reschedule' },
        { id: WA_ACTION.APPT_CANCEL, title: 'Cancel it' },
        { id: WA_ACTION.MAIN_MENU, title: 'Back to menu' },
      ],
    );
    await this.sessionRepository.upsertStep(
      hospitalId,
      fromPhone,
      WHATSAPP_STEP.APPOINTMENT_ACTION,
      { appointmentId },
    );
  }

  private async handleAppointmentAction(
    hospitalId: string,
    fromPhone: string,
    session: any,
    message: InboundMessage,
  ) {
    const { appointmentId, patientId } = session.collectedData ?? {};
    if (!appointmentId || !patientId) {
      return this.promptMyAppointments(hospitalId, fromPhone);
    }

    if (message.optionId === WA_ACTION.APPT_CANCEL) {
      await this.whatsappService.sendButtons(
        hospitalId,
        fromPhone,
        'Are you sure you want to cancel this appointment?',
        [
          { id: WA_ACTION.APPT_CANCEL_YES, title: 'Yes, cancel it' },
          { id: WA_ACTION.APPT_CANCEL_NO, title: 'No, keep it' },
        ],
      );
      return this.sessionRepository.upsertStep(
        hospitalId,
        fromPhone,
        WHATSAPP_STEP.CANCEL_CONFIRM,
      );
    }
    if (message.optionId === WA_ACTION.APPT_RESCHEDULE) {
      return this.startReschedule(hospitalId, fromPhone, patientId, appointmentId);
    }
    return this.promptMyAppointments(hospitalId, fromPhone);
  }

  private async handleCancelConfirm(
    hospitalId: string,
    fromPhone: string,
    session: any,
    message: InboundMessage,
  ) {
    const { appointmentId, patientId } = session.collectedData ?? {};
    if (!appointmentId || !patientId) {
      return this.promptMyAppointments(hospitalId, fromPhone);
    }

    if (message.optionId === WA_ACTION.APPT_CANCEL_YES) {
      return this.cancelAppointment(hospitalId, fromPhone, patientId, appointmentId);
    }

    // Anything else (including "No, keep it") backs out without cancelling.
    await this.sessionRepository.clear(hospitalId, fromPhone);
    await this.whatsappService.sendText(
      hospitalId,
      fromPhone,
      'Okay, your appointment is unchanged.',
    );
    return this.sendMainMenu(hospitalId, fromPhone);
  }

  private async cancelAppointment(
    hospitalId: string,
    fromPhone: string,
    patientId: string,
    appointmentId: string,
  ) {
    try {
      const cancelled = await this.appointmentsService.cancelSelfBookedAppointment(
        hospitalId,
        patientId,
        appointmentId,
      );
      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        `Your appointment with ${cancelled.doctorName} on ${this.formatDate(cancelled.date)} at ${cancelled.time} has been cancelled.`,
      );
    } catch (error) {
      this.logger.warn(
        `WhatsApp appointment cancel failed for hospital ${hospitalId}: ${(error as Error).message}`,
      );
      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        "Sorry, we couldn't cancel that appointment. Please call the hospital.",
      );
    }
  }

  private async startReschedule(
    hospitalId: string,
    fromPhone: string,
    patientId: string,
    appointmentId: string,
  ) {
    const appointment = await this.appointmentsService.getAppointmentForPatient(
      hospitalId,
      patientId,
      appointmentId,
    );
    if (!appointment) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        "We couldn't find that appointment anymore.",
      );
      return this.sendMainMenu(hospitalId, fromPhone);
    }

    await this.whatsappService.sendList(
      hospitalId,
      fromPhone,
      `Pick a new day for your appointment with ${appointment.doctorName}:`,
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
      {
        doctorProfileId: appointment.doctorProfileId,
        mode: 'reschedule',
        rescheduleAppointmentId: appointmentId,
        patientId,
      },
    );
  }

  private async finishReschedule(
    hospitalId: string,
    fromPhone: string,
    patientId: string,
    appointmentId: string,
    date: string,
    time: string,
  ) {
    try {
      const updated = await this.appointmentsService.rescheduleSelfBookedAppointment(
        hospitalId,
        patientId,
        appointmentId,
        date,
        time,
      );
      await this.sessionRepository.clear(hospitalId, fromPhone);
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        `Done — your appointment with ${updated.doctorName} is now on ${this.formatDate(date)} at ${time}. The hospital will confirm shortly.`,
      );
    } catch (error) {
      this.logger.warn(
        `WhatsApp reschedule failed for hospital ${hospitalId}: ${(error as Error).message}`,
      );
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'Sorry, that slot was just taken. Let us try again.',
      );
      await this.startReschedule(hospitalId, fromPhone, patientId, appointmentId);
    }
  }

  private async promptForDoctor(hospitalId: string, fromPhone: string) {
    const { doctors } = await this.doctorsService.getDoctors(hospitalId, {
      status: MEMBERSHIP_STATUS.APPROVED,
      limit: String(WA_MAX_LIST_ROWS),
    });
    const bookable = doctors.filter((d: any) => d.isAcceptingBookings);

    if (bookable.length === 0) {
      // Instead of a dead end, capture the patient as a callback lead the
      // same way "General enquiry" does, so a fully-booked/misconfigured
      // hospital doesn't just lose the patient.
      await this.whatsappService.sendText(
        hospitalId,
        fromPhone,
        'Sorry, no doctors are available for online booking right now. Please share your name and what you need, and our team will call you back to help.',
      );
      await this.sessionRepository.upsertStep(
        hospitalId,
        fromPhone,
        WHATSAPP_STEP.ENQUIRY_CAPTURE,
        { enquiryReason: 'booking_unavailable' },
      );
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
    if (message.optionId === WA_ACTION.CHANGE_DOCTOR) {
      return this.promptForDoctor(hospitalId, fromPhone);
    }

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
      // Rescheduling keeps the same doctor — only a fresh booking gets the
      // "different doctor" escape.
      const isReschedule = session.collectedData?.mode === 'reschedule';
      const dateRows = this.upcomingDates().map((d) => ({
        id: `${WA_PREFIX.DATE}${d.iso}`,
        title: d.label,
      }));
      await this.whatsappService.sendList(
        hospitalId,
        fromPhone,
        isReschedule
          ? 'No slots left that day. Please pick another.'
          : 'No slots left that day. Please pick another day, or choose a different doctor.',
        'Choose day',
        isReschedule
          ? dateRows
          : [...dateRows, { id: WA_ACTION.CHANGE_DOCTOR, title: 'Choose another doctor' }],
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

    const { date, mode } = session.collectedData ?? {};
    await this.whatsappService.sendButtons(
      hospitalId,
      fromPhone,
      mode === 'reschedule'
        ? `Move your appointment to ${this.formatDate(date)} at ${time}?`
        : `Confirm your appointment on ${this.formatDate(date)} at ${time}?`,
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
        'No problem — your appointment was not booked. Type "menu" anytime to start over.',
      );
      return;
    }

    const {
      doctorProfileId,
      date,
      time,
      mode,
      rescheduleAppointmentId,
      patientId: reschedulePatientId,
    } = session.collectedData ?? {};
    if (!doctorProfileId || !date || !time) {
      await this.sessionRepository.clear(hospitalId, fromPhone);
      return this.sendMainMenu(hospitalId, fromPhone);
    }

    if (mode === 'reschedule' && rescheduleAppointmentId && reschedulePatientId) {
      return this.finishReschedule(
        hospitalId,
        fromPhone,
        reschedulePatientId,
        rescheduleAppointmentId,
        date,
        time,
      );
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
    session: any,
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

    // Flag leads that came from a blocked booking attempt so staff can see,
    // at a glance in the enquiries list, that this patient wants a callback
    // to schedule — not just a general question.
    const isBookingRequest =
      session?.collectedData?.enquiryReason === 'booking_unavailable';

    // Link to an existing patient record when one already exists (read-only
    // — a general question shouldn't conjure a new patient record on its
    // own), so staff have full context on who's asking, not just a phone
    // number and a typed name.
    const existingPatient = await this.patientLookup.findExisting(hospitalId, fromPhone);

    await this.enquiryRepository.create({
      hospitalId,
      fromPhone,
      patientId: existingPatient?.patientId,
      patientName: profileName,
      message: isBookingRequest ? `[Booking request] ${text}` : text,
    });
    await this.sessionRepository.clear(hospitalId, fromPhone);
    await this.whatsappService.sendText(
      hospitalId,
      fromPhone,
      isBookingRequest
        ? "Thanks — we've got your request and our team will call you back shortly to schedule your appointment."
        : 'Thanks — we have passed this to our team and will reply soon.',
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
