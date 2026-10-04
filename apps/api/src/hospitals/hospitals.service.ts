import { Injectable } from '@nestjs/common';
import { startOfDay, endOfDay, format, parse } from 'date-fns';
import { HospitalRepository } from '../repositories/hospital.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { UserRepository } from '../repositories/user.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import {
  BUILT_IN_PATIENT_NOTE_FIELDS,
  DB_COLLECTIONS,
  HOSPITAL_MODULE,
  HOSPITAL_MODULE_LABELS,
  HOSPITAL_MODULE_VALUES,
  ROLE,
  VISIT_FINISHED_STATUSES,
} from '../constants';
import type { PatientNoteField } from '../constants';
import { resolveHospitalModules } from './hospital-modules.util';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { getDateCategory } from '../utils/dateUtils';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { AdminDashboardData, DoctorDashboardData } from '../types/dashboard';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 60_000; // 1 minute

const ALLOWED_HOSPITAL_UPDATE_FIELDS = [
  'name',
  'address',
  'email',
  'phone',
  'secondaryNumber',
  'specializations',
  'city',
  'location',
  'logo',
  'website',
  'description',
];

@Injectable()
export class HospitalsService {
  private readonly dashboardCache = new Map<string, CacheEntry>();

  constructor(
    private readonly hospitalRepository: HospitalRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly patientRepository: PatientRepository,
    private readonly dashboardRepository: DashboardRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly auditService: AuditService,
  ) {}

  async getAllHospitals() {
    return this.hospitalRepository.getAllHospitals();
  }

  async createHospital(user: JwtUser, body: Record<string, any>) {
    const hospital = await this.hospitalRepository.createHospital({
      name: body.name,
      address: body.address,
      phone: body.phone,
      email: body.email,
      website: body.website,
      description: body.description,
    });

    await this.subscriptionsService.provisionForNewHospital(hospital.id, body.billingCycle, body.trialDays);

    const adminEmails: string[] = Array.isArray(body.adminEmails) ? body.adminEmails : [];
    const uniqueAdminEmails = [...new Set(adminEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))];

    // Admins are provisioned by email rather than defaulting to the creator —
    // the platform admin creating the hospital isn't necessarily who runs it.
    // A User doc is created up front for anyone who hasn't signed in yet; it
    // gets linked to their Google account on first login (see AuthService.login).
    for (const email of uniqueAdminEmails) {
      const adminUser = await this.userRepository.getOrCreateUserByEmail(email);
      await this.membershipRepository.createHospitalMembership({
        hospitalId: hospital.id,
        userId: adminUser.id,
        role: ROLE.ADMIN,
        status: 'approved',
        invitedBy: user.userId,
        isProfileUpdated: false,
        isExperienceUpdated: false,
        isAvailabilityUpdated: false,
      });
    }

    return hospital;
  }

  async getHospitalById(hospitalId: string) {
    const hospital = await this.hospitalRepository.getHospitalById(hospitalId);
    if (!hospital) {
      throw ApiError.notFound('Hospital not found');
    }
    return hospital;
  }

  async updateHospital(hospitalId: string, body: Record<string, any>) {
    const updateData: Record<string, any> = {};
    ALLOWED_HOSPITAL_UPDATE_FIELDS.forEach((field) => {
      if (body[field] !== undefined) updateData[field] = body[field];
    });

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    return this.hospitalRepository.updateHospital(hospitalId, updateData);
  }

  async getSpecializations(hospitalId: string) {
    const hospital = await this.getHospitalById(hospitalId);
    return { specializations: hospital.specializations || [] };
  }

  async updateSpecializations(hospitalId: string, specializations: string[]) {
    const deduped = [...new Set(specializations.map((s) => s.trim()).filter(Boolean))];
    const hospital = await this.hospitalRepository.updateHospital(hospitalId, { specializations: deduped });
    return { specializations: hospital.specializations || [] };
  }

  // Every module in catalog order with its switch and effective state, so
  // the web app can both render Settings > Features and hide whatever's
  // unusable (plan-withheld, switched off, or missing a dependency).
  async getModules(hospitalId: string) {
    const hospital = await this.getHospitalById(hospitalId);
    return this.resolveModulesResponse(hospitalId, (hospital as any).modules);
  }

  async updateModules(hospitalId: string, changes: Partial<Record<HOSPITAL_MODULE, boolean>>, actor: HospitalUserProfile) {
    const hospital = await this.getHospitalById(hospitalId);
    const current: Record<string, boolean> = { ...((hospital as any).modules || {}) };
    const changed = HOSPITAL_MODULE_VALUES.filter(
      (key) => changes[key] !== undefined && (current[key] !== false) !== changes[key],
    );

    if (changed.length === 0) {
      return this.resolveModulesResponse(hospitalId, current);
    }

    const next = { ...current };
    changed.forEach((key) => (next[key] = changes[key]!));
    await this.hospitalRepository.updateHospital(hospitalId, { modules: next });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'hospital.modules_updated',
      area: 'settings',
      summary: changed
        .map((key) => `${next[key] ? 'Turned on' : 'Turned off'} ${HOSPITAL_MODULE_LABELS[key]}`)
        .join(', '),
      detail: Object.fromEntries(changed.map((key) => [key, next[key]])),
    });

    return this.resolveModulesResponse(hospitalId, next);
  }

  private async resolveModulesResponse(hospitalId: string, saved: unknown) {
    const subscription = await this.subscriptionsService.getSubscription(hospitalId);
    const resolved = resolveHospitalModules(saved, subscription?.features as any);
    return { modules: HOSPITAL_MODULE_VALUES.map((key) => resolved[key]) };
  }

  // Always returns the full, ordered list the patient form should render:
  // the hospital's saved config with any missing built-ins appended (so
  // hospitals that never configured this get today's four fields), and
  // built-in types pinned so a saved config can't turn allergies into text.
  // With the Custom patient fields module switched off, the saved config is
  // ignored (not deleted) and everyone gets the built-in defaults.
  async getPatientNoteFields(hospitalId: string) {
    const hospital = await this.getHospitalById(hospitalId);
    const customizable = resolveHospitalModules((hospital as any).modules, undefined)[HOSPITAL_MODULE.PATIENT_FIELDS]
      .enabled;
    return {
      fields: this.resolvePatientNoteFields(customizable ? (hospital as any).patientNoteFields : undefined),
    };
  }

  async updatePatientNoteFields(hospitalId: string, fields: PatientNoteField[]) {
    const seen = new Set<string>();
    for (const field of fields) {
      if (seen.has(field.key)) {
        throw ApiError.badRequest(`Duplicate field key: ${field.key}`);
      }
      seen.add(field.key);
    }

    const resolved = this.resolvePatientNoteFields(fields);
    // builtIn is derived on read, not stored.
    const toStore = resolved.map(({ builtIn: _builtIn, ...rest }) => rest);
    await this.hospitalRepository.updateHospital(hospitalId, { patientNoteFields: toStore });
    return { fields: resolved };
  }

  private resolvePatientNoteFields(saved: unknown): PatientNoteField[] {
    const savedList: PatientNoteField[] = Array.isArray(saved) ? saved : [];
    const builtIns = new Map(BUILT_IN_PATIENT_NOTE_FIELDS.map((f) => [f.key, f]));
    const result: PatientNoteField[] = [];
    const seen = new Set<string>();

    for (const field of savedList) {
      if (!field?.key || seen.has(field.key)) continue;
      seen.add(field.key);
      const builtIn = builtIns.get(field.key);
      result.push(
        builtIn
          ? { ...builtIn, ...field, type: builtIn.type, builtIn: true }
          : { ...field, builtIn: false },
      );
    }

    for (const builtIn of BUILT_IN_PATIENT_NOTE_FIELDS) {
      if (!seen.has(builtIn.key)) result.push({ ...builtIn });
    }

    return result;
  }

  async deleteHospital(hospitalId: string) {
    const hospital = await this.hospitalRepository.getHospitalById(hospitalId);
    if (!hospital) {
      throw ApiError.notFound('Hospital not found');
    }

    // Memberships are hospital-scoped and meaningless once the hospital is
    // gone — leaving them behind would show up as ghost entries in affected
    // users' hospital lists on their next login.
    await this.membershipRepository.deleteHospitalMemberships(hospitalId);
    await this.hospitalRepository.deleteHospital(hospitalId);

    return { success: true, message: 'Hospital deleted successfully' };
  }

  async requestAccess(user: JwtUser, hospitalId: string, role: string | undefined, message: string | undefined) {
    const existingRequest = await this.membershipRepository.getHospitalMembershipData(user.userId, hospitalId);
    if (existingRequest) {
      throw ApiError.conflict('Request already exists for this hospital');
    }

    await this.membershipRepository.createHospitalMembership({
      hospitalId,
      userId: user.userId,
      role: role || ROLE.DOCTOR,
      status: 'pending',
      message: message || '',
      invitedBy: 'self',
      isProfileUpdated: false,
      isExperienceUpdated: false,
      isAvailabilityUpdated: false,
    });

    if (role === ROLE.DOCTOR) {
      await this.doctorRepository.upsertDoctorProfile(user.userId, {
        name: user.name || '',
        email: user.email || '',
        createdAt: new Date(),
        specialties: [],
        bio: '',
      });
    }

    return { success: true };
  }

  async getPendingDoctorCount(hospitalId: string) {
    const count = await this.membershipRepository.countHospitalMembers({
      hospitalId,
      status: 'pending',
      role: 'doctor',
    });
    return { count };
  }

  async getDashboard(hospitalId: string, userId: string) {
    const userRole = await this.membershipRepository.getUserHospitalRole(userId, hospitalId);
    if (!userRole) throw ApiError.forbidden('No access to this hospital');

    const cacheKey = `dashboard-${hospitalId}-${userId}`;
    const now = Date.now();
    const cached = this.dashboardCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const dashboardData =
      userRole === ROLE.ADMIN
        ? await this.getAdminDashboardData(hospitalId)
        : await this.getDoctorDashboardData(hospitalId, userId);

    this.dashboardCache.set(cacheKey, { data: dashboardData, timestamp: now });
    return dashboardData;
  }

  private async getAdminDashboardData(hospitalId: string): Promise<AdminDashboardData> {
    try {
      const todayStartISO = startOfDay(new Date()).toISOString();
      const todayEndISO = endOfDay(new Date()).toISOString();

      const [totalPatients, totalDoctors, pendingDoctors, totalAppointments, todayAppointments, upcomingAppointmentsRaw, staffOnDuty] =
        await Promise.all([
          this.dashboardRepository.countDocuments(DB_COLLECTIONS.PATIENTS, { hospitalId }),
          this.dashboardRepository.countDocuments(DB_COLLECTIONS.HOSPITAL_MEMBERS, {
            hospitalId,
            role: 'doctor',
            status: 'approved',
          }),
          this.dashboardRepository.countDocuments(DB_COLLECTIONS.HOSPITAL_MEMBERS, {
            hospitalId,
            role: 'doctor',
            status: 'pending',
          }),
          this.dashboardRepository.countDocuments(DB_COLLECTIONS.APPOINTMENTS, { hospitalId }),
          this.dashboardRepository.countDocumentsBetween(DB_COLLECTIONS.APPOINTMENTS, {
            hospitalId,
            field: 'date',
            start: todayStartISO,
            end: todayEndISO,
          }),
          this.dashboardRepository.getHospitalUpcomingAppointments(hospitalId),
          this.dashboardRepository.getStaffOnDutyCount(hospitalId),
        ]);

      const upcomingAppointments = await this.enhanceAppointments(upcomingAppointmentsRaw, hospitalId);

      return {
        totalPatients,
        totalDoctors,
        totalAppointments,
        todayAppointments,
        pendingDoctors,
        revenue: 0,
        occupancyRate: 0,
        availableBeds: 0,
        staffOnDuty,
        upcomingAppointments,
      };
    } catch (error) {
      console.error('Admin dashboard error', error);
      return this.defaultAdminDashboard();
    }
  }

  private async getDoctorDashboardData(hospitalId: string, userId: string): Promise<DoctorDashboardData> {
    try {
      const todayStartISO = startOfDay(new Date()).toISOString();
      const todayEndISO = endOfDay(new Date()).toISOString();

      const doctorProfile = await this.doctorRepository.getDoctorProfileByHospitalAndUserId(hospitalId, userId);
      const doctorId = (doctorProfile as any)?.id || userId;

      const [todaysAppointments, completedAppointments, pendingAppointments, totalPatients, upcomingAppointmentsRaw] = await Promise.all([
        this.dashboardRepository.countDoctorAppointments(hospitalId, doctorId, todayStartISO, todayEndISO, 'scheduled'),
        this.dashboardRepository.countDoctorAppointments(hospitalId, doctorId, todayStartISO, todayEndISO, VISIT_FINISHED_STATUSES),
        this.dashboardRepository.countDoctorAppointments(hospitalId, doctorId, todayStartISO, todayEndISO, 'pending'),
        this.dashboardRepository.getDoctorPatientCount(hospitalId, doctorId),
        this.dashboardRepository.getDoctorUpcomingAppointments(hospitalId, doctorId),
      ]);

      const upcomingAppointments = await this.enhanceAppointments(upcomingAppointmentsRaw, hospitalId);

      const nextAppointment = upcomingAppointments[0]
        ? {
            patientName: upcomingAppointments[0].patient?.name ?? 'Unknown Patient',
            date: upcomingAppointments[0].date,
            time: upcomingAppointments[0].time,
            type: upcomingAppointments[0].notes || 'Consultation',
            category: upcomingAppointments[0].dateCategory,
          }
        : null;

      return {
        todaysAppointments,
        completedAppointments,
        pendingAppointments,
        totalPatients,
        averageRating: 0,
        nextAppointment: nextAppointment as any,
        upcomingAppointments: upcomingAppointments.slice(0, 5),
        recentActivity: [],
        specialization: (doctorProfile as any)?.specialization ?? 'General',
      };
    } catch (error) {
      console.error('Doctor dashboard error', error);
      return this.defaultDoctorDashboard();
    }
  }

  private defaultAdminDashboard(): AdminDashboardData {
    return {
      totalPatients: 0,
      totalDoctors: 0,
      totalAppointments: 0,
      todayAppointments: 0,
      pendingDoctors: 0,
      revenue: 0,
      occupancyRate: 0,
      availableBeds: 0,
      staffOnDuty: 0,
      upcomingAppointments: [],
    };
  }

  private defaultDoctorDashboard(): DoctorDashboardData {
    return {
      todaysAppointments: 0,
      completedAppointments: 0,
      pendingAppointments: 0,
      totalPatients: 0,
      averageRating: 0,
      nextAppointment: null,
      upcomingAppointments: [],
      recentActivity: [],
      specialization: 'General',
    };
  }

  private formatDate(date: string | Date) {
    try {
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  }

  private async enhanceAppointments(docs: any[], hospitalId: string): Promise<any[]> {
    const appointments = docs;

    const patientIds = [...new Set(appointments.map((a) => a.patientId).filter(Boolean))];
    const doctorIds = [...new Set(appointments.map((a) => a.doctorProfileId).filter(Boolean))];

    const [patients, doctors] = await Promise.all([
      this.patientRepository.getPatientsByIds(patientIds, hospitalId),
      this.doctorRepository.getDoctorProfilesByIds(doctorIds, hospitalId),
    ]);

    const patientsMap = new Map(patients.map((x: any) => [x.id, x]));
    const doctorsMap = new Map(doctors.map((x: any) => [x.id, x]));

    return appointments.map((a) => {
      const patient = patientsMap.get(a.patientId) as any;
      const doctor = doctorsMap.get(a.doctorProfileId) as any;
      const parsedTime = parse(a.time, 'HH:mm', new Date(2000, 0, 1));
      const formattedTime = format(parsedTime, 'h:mm a');
      const dateLabel = getDateCategory(a.date);

      return {
        ...a,
        patientName: patient?.name ?? 'Unknown Patient',
        doctorName: doctor?.name ?? 'Unassigned Doctor',
        patient: patient ? { id: patient.id, name: patient.name } : undefined,
        doctor: doctor ? { id: doctor.id, name: doctor.name } : undefined,
        type: a.type || a.notes || 'Consultation',
        time: formattedTime,
        date: this.formatDate(a.date),
        dateCategory: dateLabel,
      };
    });
  }
}
