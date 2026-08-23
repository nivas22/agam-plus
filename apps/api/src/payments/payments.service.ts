import { Injectable } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { PaymentDayCloseRepository } from '../repositories/payment-day-close.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { UserRepository } from '../repositories/user.repository';
import { PackageRepository } from '../repositories/package.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import {
  JwtUser,
  HospitalUserProfile,
} from '../auth/decorators/current-user.decorator';
import {
  CompleteVisitBody,
  UpdatePaymentBody,
  RefundPaymentBody,
  PaymentListQuery,
  CloseDayBody,
} from './payments.types';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  isValidAppointmentTransition,
  PACKAGE_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PERMISSION_STATE,
  FOLLOW_UP_DAY_OFFSETS,
} from '../constants';

interface DayTotals {
  cashCollected: number;
  upiCollected: number;
  unpaid: number;
  refundsPaidOut: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly paymentDayCloseRepository: PaymentDayCloseRepository,
    private readonly patientRepository: PatientRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly userRepository: UserRepository,
    private readonly packageRepository: PackageRepository,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  // Legacy `closedBy` values stamped before this was fixed to store a display
  // name are raw Mongo ids — recognizable as 24 hex chars.
  private looksLikeUserId(value: string): boolean {
    return /^[0-9a-f]{24}$/i.test(value);
  }

  // Formats the LOCAL calendar date directly — `.toISOString()` converts to
  // UTC first, which shifts the date a day back in timezones ahead of UTC.
  private toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Half-open [start, end) range for a calendar day, keyed off createdAt (UTC,
  // matching how the rest of the app stamps timestamps with `new Date()`).
  private dateRangeForDay(date: string): { start: Date; end: Date } {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  // Splits a day's payments into what actually moved through the physical
  // cash drawer vs UPI vs what's still outstanding — the numbers "Close the
  // day" reconciles against. Only the cash leg of a refund/split affects the drawer.
  private aggregateDayTotals(payments: any[]): DayTotals {
    const totals: DayTotals = {
      cashCollected: 0,
      upiCollected: 0,
      unpaid: 0,
      refundsPaidOut: 0,
    };
    for (const p of payments) {
      if (p.status === PAYMENT_STATUS.PAID) {
        if (p.method === PAYMENT_METHOD.CASH) totals.cashCollected += p.total;
        else if (p.method === PAYMENT_METHOD.UPI)
          totals.upiCollected += p.total;
        else if (p.method === PAYMENT_METHOD.SPLIT) {
          totals.cashCollected += p.splitCashAmount || 0;
          totals.upiCollected += p.splitUpiAmount || 0;
        }
      } else if (p.status === PAYMENT_STATUS.DUE) {
        totals.unpaid += p.total;
      } else if (p.status === PAYMENT_STATUS.REFUNDED) {
        if (p.method === PAYMENT_METHOD.CASH) totals.refundsPaidOut += p.total;
        else if (p.method === PAYMENT_METHOD.SPLIT)
          totals.refundsPaidOut += p.splitCashAmount || 0;
      }
    }
    return totals;
  }

  async getPayments(hospitalId: string, query: PaymentListQuery) {
    if (query.appointmentId) {
      const payment = await this.paymentRepository.getPaymentByAppointmentId(
        hospitalId,
        query.appointmentId,
      );
      const payments = payment ? await this.enrichPayments([payment]) : [];
      return { payments, total: payments.length };
    }

    const rawPayments = await this.paymentRepository.getPaymentsWithFilters({
      hospitalId,
      status: query.status,
      method: query.method,
      patientId: query.patientId,
      doctorProfileId: query.doctorProfileId,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
    const payments = await this.enrichPayments(rawPayments);

    return { payments, total: payments.length };
  }

  // Fills in patientName/patientPhone/doctorName for any payment missing its
  // snapshot (e.g. records created before that snapshot was added, or a
  // lookup that failed at completion time) — same $in-lookup shape as
  // AppointmentsService.getAppointments, but only for what's actually missing.
  private async enrichPayments(payments: any[]): Promise<any[]> {
    const missingPatientIds = Array.from(
      new Set(payments.filter((p) => !p.patientName).map((p) => p.patientId)),
    ).filter(Boolean);
    const missingDoctorIds = Array.from(
      new Set(
        payments
          .filter((p) => !p.doctorName && p.doctorProfileId)
          .map((p) => p.doctorProfileId),
      ),
    ).filter(Boolean);

    if (missingPatientIds.length === 0 && missingDoctorIds.length === 0) {
      return payments;
    }

    const [patients, doctors] = await Promise.all([
      missingPatientIds.length
        ? this.patientRepository.getPatientsByIds(missingPatientIds)
        : Promise.resolve([]),
      missingDoctorIds.length
        ? this.doctorRepository.getDoctorProfilesByIds(missingDoctorIds)
        : Promise.resolve([]),
    ]);
    const patientMap = new Map(patients.map((p: any) => [p.id, p]));
    const doctorMap = new Map(doctors.map((d: any) => [d.id, d]));

    return payments.map((p) => ({
      ...p,
      patientName: p.patientName || patientMap.get(p.patientId)?.name,
      patientPhone: p.patientPhone || patientMap.get(p.patientId)?.phone,
      doctorName: p.doctorName || doctorMap.get(p.doctorProfileId)?.name,
    }));
  }

  async completeVisit(
    hospitalId: string,
    user: JwtUser,
    userProfile: HospitalUserProfile,
    body: CompleteVisitBody,
  ) {
    const userRole = userProfile?.role;

    if (userRole !== 'admin' && userProfile?.hospitalId !== hospitalId) {
      throw ApiError.forbidden('Unauthorized - Access denied to this hospital');
    }

    const { appointmentId, sessionNotes, followUp, items, discount, method } =
      body;

    const appointment =
      await this.appointmentRepository.getAppointmentById(appointmentId);
    if (!appointment) {
      throw ApiError.notFound('Appointment not found');
    }

    const existingData = appointment as any;

    if (existingData.hospitalId !== hospitalId) {
      throw ApiError.notFound('Appointment not found in this hospital');
    }

    if (
      userRole === 'doctor' &&
      existingData.doctorProfileId !== userProfile?.userId
    ) {
      throw ApiError.forbidden(
        'Unauthorized - Can only complete your own appointments',
      );
    }

    if (
      !isValidAppointmentTransition(
        existingData.status,
        APPOINTMENT_STATUS.COMPLETED,
      )
    ) {
      throw ApiError.badRequest(
        `Cannot complete an appointment from status '${existingData.status}'`,
      );
    }

    const existingPayment =
      await this.paymentRepository.getPaymentByAppointmentId(
        hospitalId,
        appointmentId,
      );
    if (existingPayment) {
      throw ApiError.conflict(
        'A bill has already been recorded for this visit',
      );
    }

    // The client's `usePackageVisit` choice is only ever a request — capacity
    // is re-checked here against the package itself so a stale client can't
    // force coverage that isn't actually available.
    const isPackageAppointment =
      existingData.type === APPOINTMENT_TYPE.PACKAGE &&
      !!existingData.packageId;
    const pkg = isPackageAppointment
      ? await this.packageRepository.getPackageById(
          hospitalId,
          existingData.packageId,
        )
      : null;
    const todayIso = this.toISODate(new Date());
    const packageHasCapacity =
      !!pkg &&
      (pkg as any).status === PACKAGE_STATUS.ACTIVE &&
      (pkg as any).usedVisits < (pkg as any).totalVisits &&
      (pkg as any).validUntil >= todayIso;
    const useCoverage = body.usePackageVisit !== false && packageHasCapacity;

    // Auto-added items (the doctor's consultation) are what a package credit
    // draws on — anything the desk adds during the visit is always billed.
    const coveredAmount = useCoverage
      ? items
          .filter((item) => item.isAuto)
          .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      : 0;
    const billedItems = items.map((item) =>
      useCoverage && item.isAuto
        ? { ...item, isPackageCovered: true }
        : { ...item, isPackageCovered: false },
    );

    const rawSubtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const subtotal = rawSubtotal - coveredAmount;
    const total = Math.max(subtotal - discount, 0);

    // apply_discount's "needs approval" state is simplified to a hard cap
    // here rather than a queued approval — completeVisit is a single
    // synchronous checkout with no natural pause point mid-transaction.
    if (discount > 0) {
      const cap = await this.permissionsService.getDiscountCap(hospitalId, userRole, {
        isOwner: userProfile?.isOwner,
      });
      if (cap !== undefined && discount > cap) {
        throw ApiError.forbidden(`A discount above ₹${cap} needs an admin to apply it`);
      }
    }

    // patientName/doctorName on the appointment doc itself are only ever
    // stamped on creation (or never, for patientName) — the appointments
    // list gets its display names from a read-time $in lookup instead. Do
    // the same lookup here so the payment's own denormalized snapshot is accurate.
    const [patient, doctor] = await Promise.all([
      this.patientRepository.getPatientById(existingData.patientId),
      existingData.doctorProfileId
        ? this.doctorRepository.getDoctorProfileById(
            existingData.doctorProfileId,
          )
        : Promise.resolve(null),
    ]);

    const paymentData: Record<string, any> = {
      hospitalId,
      appointmentId,
      patientId: existingData.patientId,
      patientName: (patient as any)?.name || existingData.patientName,
      patientPhone: (patient as any)?.phone || existingData.patientPhone,
      doctorProfileId: existingData.doctorProfileId,
      doctorName: (doctor as any)?.name || existingData.doctorName,
      items: billedItems,
      subtotal,
      discount,
      total,
      method,
      sendReceiptWhatsApp: body.sendReceiptWhatsApp,
      createdBy: user.uid,
      collectedByUserId: userProfile?.userId,
    };
    if (useCoverage) {
      paymentData.packageId = existingData.packageId;
      paymentData.packageCoveredAmount = coveredAmount;
    }

    if (method === PAYMENT_METHOD.CASH) {
      if (body.amountTendered == null || body.amountTendered < total) {
        throw ApiError.badRequest(
          'Amount received must cover the total payable',
        );
      }
      paymentData.amountTendered = body.amountTendered;
      paymentData.changeDue = body.amountTendered - total;
      paymentData.collectedBy = body.collectedBy;
      paymentData.status = PAYMENT_STATUS.PAID;
    } else if (method === PAYMENT_METHOD.UPI) {
      paymentData.upiReference = body.upiReference;
      paymentData.status = PAYMENT_STATUS.PAID;
    } else if (method === PAYMENT_METHOD.SPLIT) {
      const cash = body.splitCashAmount ?? 0;
      const upi = body.splitUpiAmount ?? 0;
      if (cash + upi !== total) {
        throw ApiError.badRequest(
          'Split amounts must add up to the total payable',
        );
      }
      paymentData.splitCashAmount = cash;
      paymentData.splitUpiAmount = upi;
      paymentData.status = PAYMENT_STATUS.PAID;
    } else if (method === PAYMENT_METHOD.DUE) {
      if (!body.dueReason) {
        throw ApiError.badRequest(
          'A reason is required to record this visit as unpaid',
        );
      }
      paymentData.dueReason = body.dueReason;
      paymentData.status = PAYMENT_STATUS.DUE;
    }

    const invoiceYear = new Date().getFullYear();
    const sequence =
      (await this.paymentRepository.countPaymentsForYear(
        hospitalId,
        invoiceYear,
      )) + 1;
    paymentData.invoiceYear = invoiceYear;
    paymentData.invoiceNumber = `INV-${invoiceYear}-${String(sequence).padStart(4, '0')}`;

    const payment = await this.paymentRepository.createPayment(paymentData);

    if (paymentData.status === PAYMENT_STATUS.PAID) {
      await this.auditService.log({
        hospitalId,
        actor: { userId: userProfile.userId, name: userProfile.name, role: userRole },
        action: 'payment.collected',
        area: 'money',
        summary: `Collected ₹${total} ${method} on ${paymentData.invoiceNumber ?? 'this visit'} · ${paymentData.patientName ?? ''}`.trim(),
        amount: total,
      });
    }

    const updateData: Record<string, any> = {
      status: APPOINTMENT_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      updatedBy: user.uid,
      updatedByRole: userRole,
    };
    if (sessionNotes) {
      updateData.sessionNotes = sessionNotes;
    }

    await this.appointmentRepository.updateAppointment(
      appointmentId,
      updateData,
    );

    // Booking a package visit only reserves the slot — the credit is spent
    // only once coverage was actually applied above (the patient may have
    // opted out, or the package may have run out of capacity by now).
    if (useCoverage && pkg) {
      const newUsedVisits = Math.min(
        (pkg as any).totalVisits,
        (pkg as any).usedVisits + 1,
      );
      await this.packageRepository.updatePackage(
        hospitalId,
        existingData.packageId,
        { usedVisits: newUsedVisits },
      );
    }

    let followUpAppointmentId: string | null = null;
    const followUpDays = followUp ? FOLLOW_UP_DAY_OFFSETS[followUp] : undefined;
    if (followUpDays) {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + followUpDays);

      // Drafted as PENDING — the front desk still has to confirm it, matching
      // the state machine's reserved "not yet confirmed" status.
      followUpAppointmentId =
        await this.appointmentRepository.createAppointment({
          hospitalId,
          doctorProfileId: existingData.doctorProfileId,
          doctorName: existingData.doctorName,
          doctorSpecialization: existingData.doctorSpecialization,
          patientId: existingData.patientId,
          patientName: existingData.patientName,
          // Local date components, not `.toISOString()` — that converts to
          // UTC first and shifts the date back a day in timezones ahead of
          // UTC (e.g. IST).
          date: `${followUpDate.getFullYear()}-${String(followUpDate.getMonth() + 1).padStart(2, '0')}-${String(followUpDate.getDate()).padStart(2, '0')}`,
          time: existingData.time,
          status: APPOINTMENT_STATUS.PENDING,
          type: APPOINTMENT_TYPE.FOLLOW_UP,
          notes: 'Follow-up scheduled at visit completion',
          createdBy: user.uid,
          userRole,
        });
    }

    return {
      success: true,
      message:
        method === PAYMENT_METHOD.DUE
          ? `Visit completed with ${total} due`
          : 'Visit completed and payment recorded',
      payment,
      followUpAppointmentId,
    };
  }

  async updatePayment(
    hospitalId: string,
    userProfile: HospitalUserProfile,
    paymentId: string,
    body: UpdatePaymentBody,
  ) {
    if (
      userProfile?.role !== 'admin' &&
      userProfile?.hospitalId !== hospitalId
    ) {
      throw ApiError.forbidden('Unauthorized - Access denied to this hospital');
    }

    const payment = await this.paymentRepository.getPaymentById(
      hospitalId,
      paymentId,
    );
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    const existingData = payment as any;

    const paymentDate = new Date(existingData.createdAt)
      .toISOString()
      .split('T')[0];
    const dayClose = await this.paymentDayCloseRepository.getByDate(
      hospitalId,
      paymentDate,
    );
    if (dayClose) {
      // A role granted 'edit_closed_invoice' can bypass this lock; everyone
      // else (including admin's own default, which is BLOCKED — see
      // permission-catalog.ts) hits the original hard rule.
      const editState = await this.permissionsService.getActionState(
        hospitalId,
        userProfile.role,
        'edit_closed_invoice',
        { isOwner: userProfile?.isOwner },
      );
      if (editState !== PERMISSION_STATE.ALLOWED) {
        throw ApiError.badRequest(
          'This day is closed — only refunds are allowed',
        );
      }
    }

    const updates: Record<string, any> = {};

    if (
      body.status === PAYMENT_STATUS.PAID &&
      existingData.status === PAYMENT_STATUS.DUE
    ) {
      if (!body.method) {
        throw ApiError.badRequest(
          'A collection method is required to settle this due',
        );
      }
      updates.method = body.method;
      updates.status = PAYMENT_STATUS.PAID;
      updates.settledAt = new Date();
      if (body.method === PAYMENT_METHOD.CASH) {
        if (
          body.amountTendered == null ||
          body.amountTendered < existingData.total
        ) {
          throw ApiError.badRequest(
            'Amount received must cover the total payable',
          );
        }
        updates.amountTendered = body.amountTendered;
        updates.changeDue = body.amountTendered - existingData.total;
        updates.collectedBy = body.collectedBy;
      } else if (body.method === PAYMENT_METHOD.UPI) {
        updates.upiReference = body.upiReference;
      }
      updates.collectedByUserId = userProfile.userId;
    } else if (body.upiReference !== undefined) {
      updates.upiReference = body.upiReference;
    }

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No valid updates provided');
    }

    await this.paymentRepository.updatePayment(hospitalId, paymentId, updates);

    return { success: true, message: 'Payment updated' };
  }

  // Extracted out of updatePayment so 'issue_refund' can be permission-gated
  // independently of due-settlement edits (see PermissionGuard + the
  // POST .../payments/:paymentId/refund route). Refunds are intentionally
  // exempt from the day-close lock, same as before this extraction.
  async refundPayment(
    hospitalId: string,
    userProfile: HospitalUserProfile,
    paymentId: string,
    body: RefundPaymentBody,
  ) {
    if (
      userProfile?.role !== 'admin' &&
      userProfile?.hospitalId !== hospitalId
    ) {
      throw ApiError.forbidden('Unauthorized - Access denied to this hospital');
    }

    const payment = await this.paymentRepository.getPaymentById(hospitalId, paymentId);
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    const existingData = payment as any;
    if (existingData.status === PAYMENT_STATUS.REFUNDED) {
      throw ApiError.conflict('This payment has already been refunded');
    }

    await this.paymentRepository.updatePayment(hospitalId, paymentId, {
      status: PAYMENT_STATUS.REFUNDED,
      refundedAt: new Date(),
      refundReason: body.refundReason,
      refundedByUserId: userProfile.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: userProfile.userId, name: userProfile.name, role: userProfile.role },
      action: 'payment.refunded',
      area: 'money',
      summary: `Refunded ₹${existingData.total} on ${existingData.invoiceNumber ?? paymentId}${existingData.patientName ? ` · ${existingData.patientName}` : ''}${body.refundReason ? ` · reason "${body.refundReason}"` : ''}`,
      amount: -existingData.total,
    });

    return { success: true, message: 'Payment refunded' };
  }

  async getDayClose(hospitalId: string, date: string) {
    const { start, end } = this.dateRangeForDay(date);
    const payments = await this.paymentRepository.getPaymentsForDateRange(
      hospitalId,
      start,
      end,
    );
    const totals = this.aggregateDayTotals(payments);

    const existing = await this.paymentDayCloseRepository.getByDate(
      hospitalId,
      date,
    );
    const openingFloat = existing?.openingFloat ?? 0;
    const expectedDrawer =
      openingFloat + totals.cashCollected - totals.refundsPaidOut;

    let closedBy = existing?.closedBy;
    if (closedBy && this.looksLikeUserId(closedBy)) {
      const closedByUser = await this.userRepository.getUserById(closedBy);
      closedBy = (closedByUser as any)?.name || closedBy;
    }

    return {
      date,
      openingFloat,
      cashCollected: totals.cashCollected,
      upiCollected: totals.upiCollected,
      unpaid: totals.unpaid,
      refundsPaidOut: totals.refundsPaidOut,
      expectedDrawer,
      closed: !!existing,
      countedAmount: existing?.countedAmount,
      variance: existing ? existing.countedAmount - expectedDrawer : undefined,
      note: existing?.note,
      closedBy,
      closedAt: existing?.closedAt,
    };
  }

  async closeDay(
    hospitalId: string,
    userProfile: HospitalUserProfile,
    body: CloseDayBody,
  ) {
    // Admin/owner always pass (see PermissionsService.isAlwaysAllowed); other
    // roles need 'close_day' allowed — accountant gets it by default (see
    // permission-catalog.ts), matching "read-only + day close".
    const closeDayState = await this.permissionsService.getActionState(hospitalId, userProfile?.role, 'close_day', {
      isOwner: userProfile?.isOwner,
    });
    if (closeDayState !== PERMISSION_STATE.ALLOWED) {
      throw ApiError.forbidden('Only an admin (or a role granted close-day access) can close the day');
    }

    const existing = await this.paymentDayCloseRepository.getByDate(
      hospitalId,
      body.date,
    );
    if (existing) {
      throw ApiError.conflict('This day has already been closed');
    }

    const { start, end } = this.dateRangeForDay(body.date);
    const payments = await this.paymentRepository.getPaymentsForDateRange(
      hospitalId,
      start,
      end,
    );
    const totals = this.aggregateDayTotals(payments);
    const expectedDrawer =
      body.openingFloat + totals.cashCollected - totals.refundsPaidOut;
    const variance = body.countedAmount - expectedDrawer;

    if (variance !== 0 && !body.note) {
      throw ApiError.badRequest(
        "A note is required when the counted amount doesn't match",
      );
    }

    const dayClose = await this.paymentDayCloseRepository.create({
      hospitalId,
      date: body.date,
      openingFloat: body.openingFloat,
      cashCollected: totals.cashCollected,
      upiCollected: totals.upiCollected,
      refundsPaidOut: totals.refundsPaidOut,
      expectedDrawer,
      countedAmount: body.countedAmount,
      variance,
      note: body.note,
      closedBy: userProfile.name || userProfile.userId,
      closedByUserId: userProfile.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: userProfile.userId, name: userProfile.name, role: userProfile.role },
      action: 'day_close.closed',
      area: 'money',
      summary: `Closed the day for ${body.date}${variance !== 0 ? ` — drawer ${variance > 0 ? 'over' : 'short'} ₹${Math.abs(variance)}` : ''}${body.note ? ` · Note: "${body.note}"` : ''}`,
      amount: variance,
    });

    return { success: true, message: 'Day closed', dayClose };
  }
}
