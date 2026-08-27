import { Injectable } from '@nestjs/common';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { HospitalHolidayRepository } from '../repositories/hospital-holiday.repository';
import { DoctorPresenceRepository } from '../repositories/doctor-presence.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { AppointmentWithDetails, Vitals } from '../types/appointment';
import { JwtUser, HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { CreateAppointmentBody, UpdateAppointmentBody, AppointmentListQuery } from './appointments.types';
import { findHolidayForDate, filterSlotsForHoliday } from '../hospital-holidays/holiday-availability.util';
import {
  APPOINTMENT_STATUS,
  ACTIVE_APPOINTMENT_STATUSES,
  isValidAppointmentTransition,
  normalizeAppointmentStatus,
  PERMISSION_STATE,
} from '../constants';

// Timestamp field to stamp when an appointment enters a given status.
const STATUS_TIMESTAMP_FIELD: Partial<Record<APPOINTMENT_STATUS, string>> = {
  [APPOINTMENT_STATUS.CONFIRMED]: 'confirmedAt',
  [APPOINTMENT_STATUS.CHECKED_IN]: 'checkedInAt',
  [APPOINTMENT_STATUS.WAITING]: 'waitingAt',
  [APPOINTMENT_STATUS.IN_CONSULTATION]: 'consultationStartedAt',
  [APPOINTMENT_STATUS.COMPLETED]: 'completedAt',
};

interface GenerateAppointmentsParams {
  doctor: any;
  patientId: string;
  hospitalId: string;
  startDate: string;
  preferredTime: string;
  frequency: 'once' | 'weekly' | 'monthly';
  numberOfOccurrences: number;
  selectedDays: string[];
  notes: string;
  createdBy: string;
  userRole: string;
  membership: any;
  bookingSource?: 'scheduled' | 'walk-in';
  forceSlot?: boolean;
  vitals?: Vitals;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly patientRepository: PatientRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalHolidayRepository: HospitalHolidayRepository,
    private readonly doctorPresenceRepository: DoctorPresenceRepository,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async getAppointments(hospitalId: string, userProfile: HospitalUserProfile, query: AppointmentListQuery) {
    const { startDate, endDate, status, doctorId, patientId, limit } = query;

    const userRole = userProfile?.role || 'doctor';

    // Determine doctor filter based on role
    let doctorProfileIdFilter: string | undefined;
    if (userRole === 'doctor') {
      // Doctors can only see their own appointments
      doctorProfileIdFilter = userProfile?.userId;
    } else if (userRole === 'admin' && doctorId) {
      // Admins can filter by specific doctor if provided
      doctorProfileIdFilter = doctorId;
    }

    const appointments = (await this.appointmentRepository.getAppointmentsWithFilters({
      hospitalId,
      doctorProfileId: doctorProfileIdFilter,
      patientId: patientId || undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: limit ? parseInt(limit) : undefined,
    })) as AppointmentWithDetails[];

    if (appointments.length === 0) {
      return {
        appointments: [],
        total: 0,
        hospitalId,
        userRole,
      };
    }

    // Get unique patient IDs and doctor IDs for data enrichment
    const patientIds = Array.from(new Set(appointments.map((a) => a.patientId))).filter(Boolean);
    const doctorIds = Array.from(new Set(appointments.map((a) => a.doctorProfileId))).filter(Boolean);

    // Fetch related data in parallel
    const [patients, doctors] = await Promise.all([
      patientIds.length > 0 ? this.patientRepository.getPatientsByIds(patientIds, hospitalId) : [],
      doctorIds.length > 0 ? this.doctorRepository.getDoctorProfilesByIds(doctorIds, hospitalId) : [],
    ]);

    // Create lookup maps
    const patientMap: Record<string, any> = {};
    patients.forEach((patient: any) => {
      patientMap[patient.id] = patient;
    });

    const doctorMap: Record<string, any> = {};
    doctors.forEach((doctor: any) => {
      doctorMap[doctor.id] = doctor;
    });

    // Merge data into appointments
    const appointmentsWithDetails: AppointmentWithDetails[] = appointments.map((appt: AppointmentWithDetails) => {
      const patient = patientMap[appt.patientId];
      const doctor = doctorMap[appt.doctorProfileId];

      return {
        ...appt,
        patientName: patient?.name ?? 'Unknown Patient',
        patientPhone: patient?.phone ?? '',
        patientAge: patient?.age ?? null,
        patientGender: patient?.gender ?? '',
        doctorName: doctor?.name ?? appt.doctorName ?? 'Unknown Doctor',
        doctorSpecialization: doctor?.specialization ?? appt.doctorSpecialization ?? '',
      } as AppointmentWithDetails;
    });

    // read_session_notes is a response-shaping check, not a request-blocking
    // one — there's no natural way to queue a read for approval, so
    // needs_approval collapses to blocked here (see PermissionsService.getActionState).
    const notesState = await this.permissionsService.getActionState(hospitalId, userRole, 'read_session_notes', {
      isOwner: userProfile?.isOwner,
    });
    const visibleAppointments =
      notesState === PERMISSION_STATE.ALLOWED
        ? appointmentsWithDetails
        : appointmentsWithDetails.map(({ sessionNotes, ...rest }: any) => rest);

    return {
      appointments: visibleAppointments,
      total: visibleAppointments.length,
      hospitalId,
      userRole,
    };
  }

  // Single-appointment fetch for surfaces that need one appointment's
  // enriched details directly (e.g. the prescription writer route) rather
  // than filtering the list endpoint.
  async getAppointmentById(hospitalId: string, userProfile: HospitalUserProfile, appointmentId: string) {
    const appointment = (await this.appointmentRepository.getAppointmentById(appointmentId)) as AppointmentWithDetails | null;
    if (!appointment || (appointment as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Appointment not found in this hospital');
    }

    const userRole = userProfile?.role || 'doctor';
    if (userRole === 'doctor' && appointment.doctorProfileId !== userProfile?.userId) {
      throw ApiError.forbidden('This appointment belongs to a different doctor');
    }

    const [patient, doctor] = await Promise.all([
      appointment.patientId
        ? this.patientRepository.getPatientById(appointment.patientId)
        : null,
      appointment.doctorProfileId
        ? this.doctorRepository.getDoctorProfileById(appointment.doctorProfileId)
        : null,
    ]);

    return {
      appointment: {
        ...appointment,
        patientName: (patient as any)?.name ?? appointment.patientName ?? 'Unknown Patient',
        patientPhone: (patient as any)?.phone ?? appointment.patientPhone ?? '',
        patientAge: (patient as any)?.age ?? appointment.patientAge ?? null,
        patientGender: (patient as any)?.gender ?? appointment.patientGender ?? '',
        doctorName: (doctor as any)?.name ?? appointment.doctorName ?? 'Unknown Doctor',
        doctorSpecialization: (doctor as any)?.specialization ?? appointment.doctorSpecialization ?? '',
      },
    };
  }

  async createAppointment(hospitalId: string, user: JwtUser, userProfile: HospitalUserProfile, body: CreateAppointmentBody) {
    const {
      doctorProfileId,
      patientId,
      startDate,
      preferredTime,
      frequency,
      numberOfOccurrences,
      selectedDays,
      notes,
      bookingSource,
      forceSlot,
      vitals,
    } = body;

    // Verify user has access to this hospital
    if (userProfile.role !== 'admin' && userProfile.hospitalId !== hospitalId) {
      throw ApiError.forbidden('Access denied to this hospital');
    }

    const membershipRef = await this.membershipRepository.getHospitalMembership(hospitalId, doctorProfileId || userProfile.userId);

    if (membershipRef.empty) {
      throw ApiError.notFound('Membership not found');
    }

    const membershipDoc = membershipRef.docs[0];
    const membership = membershipDoc.data();

    // Verify patient belongs to this hospital
    const patientExists = await this.patientRepository.verifyPatientInHospital(patientId, hospitalId);
    if (!patientExists) {
      throw ApiError.notFound('Patient not found in this hospital');
    }

    // Verify doctor belongs to this hospital and get availability
    const doctorData = await this.doctorRepository.getDoctorProfileById(doctorProfileId);

    // Generate appointments
    const generatedAppointments = await this.generateAppointments({
      doctor: doctorData,
      patientId,
      hospitalId,
      startDate,
      preferredTime,
      frequency,
      numberOfOccurrences,
      selectedDays,
      notes,
      createdBy: user.uid,
      userRole: userProfile.role,
      membership,
      bookingSource,
      forceSlot,
      vitals,
    });

    if (generatedAppointments.length === 0) {
      throw ApiError.badRequest('No available slots found for the specified criteria');
    }

    // Save all appointments
    const appointmentIds = await this.appointmentRepository.createAppointmentsBatch(generatedAppointments);

    return {
      success: true,
      message: `Successfully created ${generatedAppointments.length} appointment(s)`,
      appointments: generatedAppointments.map((appt, index) => ({
        ...appt,
        id: appointmentIds[index],
      })),
      total: generatedAppointments.length,
    };
  }

  private async generateAppointments({
    doctor,
    patientId,
    hospitalId,
    startDate,
    preferredTime,
    frequency,
    numberOfOccurrences,
    selectedDays,
    notes,
    createdBy,
    userRole,
    membership,
    bookingSource,
    forceSlot,
    vitals,
  }: GenerateAppointmentsParams) {
    const appointments: any[] = [];
    const start = new Date(startDate);
    let count = 0;
    const maxOccurrences = frequency === 'once' ? 1 : Math.max(1, numberOfOccurrences);
    let attempts = 0;
    const SAFETY_LIMIT = 1000;

    // Drop keys the desk left blank rather than persisting an object full of
    // undefineds — same reasoning as the vitalsSchema fields all being
    // optional (not every desk has every instrument to hand).
    const cleanedVitals = vitals
      ? Object.fromEntries(Object.entries(vitals).filter(([, v]) => v != null))
      : undefined;

    // All appointments created here are admin/staff-booked (Flow 2), so they
    // start CONFIRMED directly. PENDING is reserved for a future patient
    // self-booking flow that would require admin confirmation first.
    const baseAppointmentData = {
      doctorProfileId: membership.userId,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      patientId,
      hospitalId,
      frequency,
      notes,
      bookingSource: bookingSource || 'scheduled',
      status: APPOINTMENT_STATUS.CONFIRMED as const,
      confirmedAt: new Date().toISOString(),
      createdBy,
      userRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(cleanedVitals && Object.keys(cleanedVitals).length > 0
        ? { vitals: cleanedVitals }
        : {}),
    };

    if (frequency === 'once') {
      // The walk-in board's "straight into the queue" option: skip the normal
      // slot search (which would reject once the session is at capacity) and
      // book the exact time the front desk picked — still subject to the
      // doctor's overCapacityPolicy below.
      if (forceSlot && preferredTime) {
        await this.assertWalkInCapacityAllowed(doctor, membership, startDate);
        appointments.push({
          ...baseAppointmentData,
          date: startDate,
          // Snap to the doctor's actual slot grid — a walk-in booked at
          // whatever the clock reads (e.g. 09:14) would otherwise store a
          // `time` that never matches the "09:00" bucket getAvailableSlots
          // groups bookings by, so it silently wouldn't count against that
          // slot's capacity and online booking would still offer it.
          time: this.snapToSlotGrid(doctor, membership, startDate, preferredTime),
        });
        return appointments;
      }
      const slot = await this.findNextAvailableSlot(doctor, membership, startDate, preferredTime);
      if (slot) {
        appointments.push({
          ...baseAppointmentData,
          date: slot.date,
          time: slot.time,
        });
      }
      return appointments;
    }

    if (frequency === 'weekly') {
      const cursor = new Date(start);
      while (count < maxOccurrences && attempts < SAFETY_LIMIT) {
        const dayName = cursor.toLocaleDateString('en-US', { weekday: 'long' });
        if (selectedDays.includes(dayName)) {
          const slot = await this.findNextAvailableSlot(doctor, membership, cursor.toISOString().split('T')[0], preferredTime);
          if (slot) {
            appointments.push({
              ...baseAppointmentData,
              date: slot.date,
              time: slot.time,
            });
            count++;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
        attempts++;
      }
    }

    if (frequency === 'monthly') {
      const cursor = new Date(start);
      while (count < maxOccurrences && attempts < SAFETY_LIMIT) {
        const slot = await this.findNextAvailableSlot(doctor, membership, cursor.toISOString().split('T')[0], preferredTime);
        if (slot) {
          appointments.push({
            ...baseAppointmentData,
            date: slot.date,
            time: slot.time,
          });
          count++;
        }
        cursor.setMonth(cursor.getMonth() + 1);
        attempts++;
      }
    }

    return appointments;
  }

  private async findNextAvailableSlot(doctor: any, membership: any, date: string, preferredTime: string) {
    const slots = await this.getAvailableSlots(doctor, membership, date);

    if (slots.length === 0) {
      return null;
    }

    // Try to find preferred time first
    if (preferredTime && slots.some((s) => s.time === preferredTime)) {
      return { date, time: preferredTime };
    }

    // Otherwise return first available slot
    return { date, time: slots[0].time };
  }

  private async getAvailableSlots(
    doctor: any,
    membership: any,
    date: string,
  ): Promise<{ time: string; remaining: number; capacity: number }[]> {
    try {
      const doctorAvailability = membership?.availability || [];

      // Get day of week
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

      // Check if doctor is available on this day — a day can have more than one
      // working window (e.g. a morning and an evening shift), so collect all of them.
      const dayWindows = doctorAvailability.filter((a: any) => a.day === dayOfWeek);
      if (dayWindows.length === 0) return [];

      // Check for existing appointments on this date
      // Include legacy 'scheduled' for appointments created before this status migration.
      const existingAppointments = await this.appointmentRepository.getAppointmentsByDoctorAndDate(doctor.userId, date, [
        ...ACTIVE_APPOINTMENT_STATUSES,
        'scheduled',
      ]);

      // Count how many patients are already booked into each slot, so a slot
      // stays available until it reaches the doctor's patientsPerSlot capacity.
      const bookedCounts: Record<string, number> = {};
      for (const appt of existingAppointments as any[]) {
        bookedCounts[appt.time] = (bookedCounts[appt.time] || 0) + 1;
      }

      // Check if the date is today
      const today = new Date();
      const isToday = dateObj.toDateString() === today.toDateString();
      const currentTime = isToday ? today : null;

      // A doctor marked "left for the day" is done seeing patients — today's
      // remaining slots stop being bookable the moment that's set, same as
      // they'd stop for a walk-in at the front desk. Only today: the
      // override is a same-day dashboard signal, not a standing closure.
      if (isToday && membership?.hospitalId) {
        const presence = await this.doctorPresenceRepository.getForDoctorAndDate(
          membership.hospitalId,
          membership.userId,
          date,
        );
        if ((presence as any)?.kind === 'leftForDay') return [];
      }

      // Generate all possible slots across every window for this day
      // Booking-rule fields (appointmentDuration/bufferMinutes/patientsPerSlot) are
      // hospital-scoped and persisted on the membership, not the doctor profile.
      const slots: { time: string; remaining: number; capacity: number }[] = [];
      const duration = membership?.appointmentDuration || doctor.appointmentDuration || 30;
      const gap = Math.max(0, membership?.bufferMinutes || 0);
      const capacity = Math.max(1, membership?.patientsPerSlot || 1);
      const step = duration + gap;

      for (const dayAvailability of dayWindows) {
        const startTime = new Date(`${date}T${dayAvailability.startTime}`);
        const endTime = new Date(`${date}T${dayAvailability.endTime}`);
        const current = new Date(startTime);

        // A slot only counts as bookable if the appointment fits before closing time.
        while (current.getTime() + duration * 60000 <= endTime.getTime()) {
          const timeString = current.toTimeString().substring(0, 5);

          // Skip past time slots if the date is today
          if (isToday && currentTime && current <= currentTime) {
            current.setMinutes(current.getMinutes() + step);
            continue;
          }

          // Only include slot if it hasn't reached capacity
          const booked = bookedCounts[timeString] || 0;
          if (booked < capacity) {
            slots.push({ time: timeString, remaining: capacity - booked, capacity });
          }
          current.setMinutes(current.getMinutes() + step);
        }
      }

      slots.sort((a, b) => a.time.localeCompare(b.time));

      if (membership?.hospitalId) {
        const holidays = await this.hospitalHolidayRepository.getActiveInRange(
          membership.hospitalId,
          date,
          date,
        );
        const holiday = findHolidayForDate(holidays, date);
        return filterSlotsForHoliday(slots, holiday, membership.userId);
      }

      return slots;
    } catch (err) {
      console.error('getAvailableSlots error:', err);
      return [];
    }
  }

  // Gate for `forceSlot` bookings only — the normal slot search already
  // enforces capacity by construction, this is the one path that can
  // deliberately exceed it. A 'block' policy makes that a hard no once the
  // day's total capacity (regular + walk-in, held slots included — walk-ins
  // are exactly what those are held for) is used up; 'warn'/'allow' both let
  // the desk proceed, the difference being front-end friction only.
  // Rounds an arbitrary time down to the start of whichever slot on the
  // doctor's grid it falls inside, so a walk-in booked "right now" lands on
  // the same bucket (e.g. 09:00) that online-booking capacity is counted by,
  // instead of a bespoke minute (09:14) nothing else ever matches.
  private snapToSlotGrid(doctor: any, membership: any, date: string, timeStr: string): string {
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const windows = (membership?.availability || []).filter((a: any) => a.day === dayName);
    if (windows.length === 0) return timeStr;

    const duration = membership?.appointmentDuration || doctor.appointmentDuration || 30;
    const gap = Math.max(0, membership?.bufferMinutes || 0);
    const step = duration + gap;

    const toMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const toTime = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    const target = toMins(timeStr);
    const containingWindow = windows.find((w: any) => target >= toMins(w.startTime) && target < toMins(w.endTime));
    const window =
      containingWindow ||
      [...windows].sort(
        (a: any, b: any) => Math.abs(toMins(a.startTime) - target) - Math.abs(toMins(b.startTime) - target),
      )[0];

    const winStart = toMins(window.startTime);
    const winEnd = toMins(window.endTime);
    // Clamp into the window so a walk-in just before opening or after
    // closing still lands on a valid slot rather than one outside it.
    const clamped = Math.max(winStart, Math.min(target, Math.max(winStart, winEnd - duration)));
    const stepsElapsed = Math.floor((clamped - winStart) / step);
    return toTime(winStart + stepsElapsed * step);
  }

  private async assertWalkInCapacityAllowed(doctor: any, membership: any, date: string) {
    if ((membership?.overCapacityPolicy || 'warn') !== 'block') return;

    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const windows = (membership?.availability || []).filter((a: any) => a.day === dayName);
    if (windows.length === 0) return;

    const duration = membership?.appointmentDuration || doctor.appointmentDuration || 30;
    const gap = Math.max(0, membership?.bufferMinutes || 0);
    const perSlot = Math.max(1, membership?.patientsPerSlot || 1);
    const step = duration + gap;

    let totalCapacity = 0;
    for (const w of windows) {
      const start = new Date(`${date}T${w.startTime}`);
      const end = new Date(`${date}T${w.endTime}`);
      let slotCount = 0;
      const cur = new Date(start);
      while (cur.getTime() + duration * 60000 <= end.getTime()) {
        slotCount++;
        cur.setMinutes(cur.getMinutes() + step);
      }
      totalCapacity += slotCount * perSlot;
    }

    const existing = await this.appointmentRepository.getAppointmentsByDoctorAndDate(doctor.userId, date, [
      ...ACTIVE_APPOINTMENT_STATUSES,
      'scheduled',
    ]);
    if (existing.length >= totalCapacity) {
      throw ApiError.badRequest(
        `Dr. ${doctor.name} is fully booked today and this hospital's walk-in policy blocks adding more.`,
      );
    }
  }

  async updateAppointment(hospitalId: string, user: JwtUser, userProfile: HospitalUserProfile, body: UpdateAppointmentBody) {
    const userRole = userProfile?.role;

    // Verify user has access to this hospital
    if (userRole !== 'admin' && userProfile?.hospitalId !== hospitalId) {
      throw ApiError.forbidden('Unauthorized - Access denied to this hospital');
    }

    const { appointmentId, status, sessionNotes, appointmentData } = body;

    const existingAppointment = await this.appointmentRepository.getAppointmentById(appointmentId);

    if (!existingAppointment) {
      throw ApiError.notFound('Appointment not found');
    }

    const existingData = existingAppointment as any;

    // Verify appointment belongs to this hospital
    if (existingData.hospitalId !== hospitalId) {
      throw ApiError.notFound('Appointment not found in this hospital');
    }

    // Role-based permission checks for updates
    if (userRole === 'doctor') {
      // Doctors can only update their own appointments
      if (existingData.doctorProfileId !== userProfile?.userId) {
        throw ApiError.forbidden('Unauthorized - Can only update your own appointments');
      }

      // Doctors cannot reassign appointments to other doctors
      if (appointmentData?.doctorProfileId && appointmentData.doctorProfileId !== userProfile?.userId) {
        throw ApiError.forbidden('Doctors cannot reassign appointments to other doctors');
      }
    }

    const isRescheduling = Boolean(appointmentData?.rescheduleDate && appointmentData?.rescheduleTime);

    // This one route conflates several distinct permission-catalog actions
    // (book/reschedule vs cancel/no-show vs plain clinical-queue transitions)
    // depending on what's actually being requested — so the check happens
    // here per-branch rather than as a single @RequirePermission on the route.
    const cancelLikeStatus = status === APPOINTMENT_STATUS.CANCELLED || status === APPOINTMENT_STATUS.NO_SHOW;
    if (isRescheduling) {
      await this.permissionsService.enforce(hospitalId, userProfile, 'book_reschedule', { body, params: { id: hospitalId } });
    } else if (cancelLikeStatus) {
      await this.permissionsService.enforce(hospitalId, userProfile, 'cancel_no_show', { body, params: { id: hospitalId } });
    }

    // Rescheduling is a compound action (new date/time + status reset) validated
    // on its own below; every other status change must follow the queue lifecycle.
    if (!isRescheduling && !isValidAppointmentTransition(existingData.status, status as APPOINTMENT_STATUS)) {
      const currentStatus = normalizeAppointmentStatus(existingData.status);
      throw ApiError.badRequest(`Cannot change appointment status from '${currentStatus}' to '${status}'`);
    }

    const updateData: any = {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
      updatedByRole: userRole,
    };

    // Stamp the timestamp for whichever lifecycle stage was just entered
    const timestampField = STATUS_TIMESTAMP_FIELD[status as APPOINTMENT_STATUS];
    if (timestampField && existingData.status !== status) {
      updateData[timestampField] = new Date().toISOString();
    }

    if (sessionNotes) {
      updateData.sessionNotes = sessionNotes;
    }

    if (appointmentData?.doctorProfileId) {
      // Verify the new doctor belongs to this hospital — membership, not a
      // hospitalId field on the doctor profile itself, which isn't reliably
      // populated (see DoctorPresenceService for the same fix).
      const newDoctorMembership = await this.membershipRepository.getHospitalMembership(
        hospitalId,
        appointmentData.doctorProfileId,
      );
      if (newDoctorMembership.empty) {
        throw ApiError.notFound('Doctor not found in this hospital');
      }
      const newDoctor = (await this.doctorRepository.getDoctorProfileById(appointmentData.doctorProfileId)) as any;

      updateData.doctorProfileId = appointmentData.doctorProfileId;
      updateData.doctorName = newDoctor?.name || appointmentData.doctorName || existingData.doctorName;
      updateData.doctorSpecialization = newDoctor?.specialization || existingData.doctorSpecialization;
    }

    if (appointmentData?.notes !== undefined) {
      updateData.notes = appointmentData.notes;
    }

    if (appointmentData?.cancelReason) {
      updateData.cancelReason = appointmentData.cancelReason;
    }

    if (appointmentData?.noShowReason) {
      updateData.noShowReason = appointmentData.noShowReason;
    }

    if (isRescheduling && appointmentData) {
      updateData.date = appointmentData.rescheduleDate;
      updateData.time = appointmentData.rescheduleTime;
      updateData.status = APPOINTMENT_STATUS.CONFIRMED;
      updateData.confirmedAt = new Date().toISOString();
      updateData.rescheduledAt = new Date().toISOString();
      updateData.rescheduledBy = userProfile?.userId;
    }

    await this.appointmentRepository.updateAppointment(appointmentId, updateData);

    if (isRescheduling) {
      await this.auditService.log({
        hospitalId,
        actor: { userId: userProfile.userId, name: userProfile.name, role: userRole },
        action: 'appointment.rescheduled',
        area: 'appointments',
        summary: `Rescheduled ${appointmentId}${existingData.patientName ? ` · ${existingData.patientName}` : ''} → ${updateData.date} ${updateData.time}`,
      });
    } else if (cancelLikeStatus) {
      await this.auditService.log({
        hospitalId,
        actor: { userId: userProfile.userId, name: userProfile.name, role: userRole },
        action: status === APPOINTMENT_STATUS.NO_SHOW ? 'appointment.no_show' : 'appointment.cancelled',
        area: 'appointments',
        summary: `${status === APPOINTMENT_STATUS.NO_SHOW ? 'Marked no-show' : 'Cancelled'} ${appointmentId}${existingData.patientName ? ` · ${existingData.patientName}` : ''}`,
      });
    }

    return {
      success: true,
      message: 'Appointment updated successfully',
      updatedBy: userRole,
    };
  }

  async deleteAppointment(hospitalId: string, userProfile: HospitalUserProfile, appointmentId: string) {
    if (!appointmentId) {
      throw ApiError.badRequest('Appointment ID is required');
    }

    const userRole = userProfile?.role || 'doctor';

    // Verify user has access to this hospital
    if (userRole !== 'admin' && userProfile?.hospitalId !== hospitalId) {
      throw ApiError.forbidden('Unauthorized - Access denied to this hospital');
    }

    const existingAppointment = await this.appointmentRepository.getAppointmentById(appointmentId);

    if (!existingAppointment) {
      throw ApiError.notFound('Appointment not found');
    }

    const existingData = existingAppointment as any;

    // Verify appointment belongs to this hospital
    if (existingData.hospitalId !== hospitalId) {
      throw ApiError.notFound('Appointment not found in this hospital');
    }

    // Role-based permission checks for deletion
    if (userRole === 'doctor') {
      // Doctors can only delete their own appointments
      if (existingData.doctorId !== userProfile?.userId) {
        throw ApiError.forbidden('Unauthorized - Can only delete your own appointments');
      }
    }

    // Soft delete by updating status
    await this.appointmentRepository.updateAppointment(appointmentId, {
      status: APPOINTMENT_STATUS.CANCELLED,
      deletedBy: userProfile?.userId,
      deletedByRole: userRole,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: userProfile.userId, name: userProfile.name, role: userRole },
      action: 'appointment.deleted',
      area: 'appointments',
      summary: `Deleted ${appointmentId}${existingData.patientName ? ` · ${existingData.patientName}` : ''}`,
    });

    return {
      success: true,
      message: 'Appointment deleted successfully',
      deletedBy: userRole,
    };
  }
}
