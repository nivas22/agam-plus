import { Injectable } from '@nestjs/common';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { ApiError } from '../common/errors/api-error';
import { AppointmentWithDetails } from '../types/appointment';
import { JwtUser, HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { CreateAppointmentBody, UpdateAppointmentBody, AppointmentListQuery } from './appointments.types';

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
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly patientRepository: PatientRepository,
    private readonly membershipRepository: MembershipRepository,
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

    return {
      appointments: appointmentsWithDetails,
      total: appointmentsWithDetails.length,
      hospitalId,
      userRole,
    };
  }

  async createAppointment(hospitalId: string, user: JwtUser, userProfile: HospitalUserProfile, body: CreateAppointmentBody) {
    const { doctorProfileId, patientId, startDate, preferredTime, frequency, numberOfOccurrences, selectedDays, notes } = body;

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
  }: GenerateAppointmentsParams) {
    const appointments: any[] = [];
    const start = new Date(startDate);
    let count = 0;
    const maxOccurrences = frequency === 'once' ? 1 : Math.max(1, numberOfOccurrences);
    let attempts = 0;
    const SAFETY_LIMIT = 1000;

    // IMPORTANT: All appointments are created with 'scheduled' status
    // Appointments can only be marked as 'completed' through the update endpoint
    const baseAppointmentData = {
      doctorProfileId: membership.userId,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      patientId,
      hospitalId,
      frequency,
      notes,
      status: 'scheduled' as const, // Always 'scheduled' on creation
      createdBy,
      userRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (frequency === 'once') {
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
    if (preferredTime && slots.includes(preferredTime)) {
      return { date, time: preferredTime };
    }

    // Otherwise return first available slot
    return { date, time: slots[0] };
  }

  private async getAvailableSlots(doctor: any, membership: any, date: string): Promise<string[]> {
    try {
      const doctorAvailability = membership?.availability || [];

      // Get day of week
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

      // Check if doctor is available on this day
      const dayAvailability = doctorAvailability.find((a: any) => a.day === dayOfWeek);
      if (!dayAvailability) return [];

      // Check for existing appointments on this date
      const existingAppointments = await this.appointmentRepository.getAppointmentsByDoctorAndDate(doctor.userId, date, [
        'scheduled',
        'confirmed',
      ]);

      const bookedSlots = existingAppointments.map((appt: any) => appt.time);

      // Check if the date is today
      const today = new Date();
      const isToday = dateObj.toDateString() === today.toDateString();
      const currentTime = isToday ? today : null;

      // Generate all possible slots
      const slots: string[] = [];
      const startTime = new Date(`${date}T${dayAvailability.startTime}`);
      const endTime = new Date(`${date}T${dayAvailability.endTime}`);
      const duration = doctor.appointmentDuration || 30;
      const current = new Date(startTime);

      while (current < endTime) {
        const timeString = current.toTimeString().substring(0, 5);

        // Skip past time slots if the date is today
        if (isToday && currentTime && current <= currentTime) {
          current.setMinutes(current.getMinutes() + duration);
          continue;
        }

        // Only include slot if it's not already booked
        if (!bookedSlots.includes(timeString)) {
          slots.push(timeString);
        }
        current.setMinutes(current.getMinutes() + duration);
      }

      return slots;
    } catch (err) {
      console.error('getAvailableSlots error:', err);
      return [];
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
      if (appointmentData?.doctorId && appointmentData.doctorId !== userProfile?.userId) {
        throw ApiError.forbidden('Doctors cannot reassign appointments to other doctors');
      }
    }

    const updateData: any = {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
      updatedByRole: userRole,
    };

    // Track when appointment is marked as completed
    if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    if (sessionNotes) {
      updateData.sessionNotes = sessionNotes;
    }

    if (appointmentData?.doctorId) {
      // Verify new doctor belongs to this hospital (admin only)
      if (userRole === 'admin') {
        const doctorProfile = await this.doctorRepository.getDoctorProfileByUserId(appointmentData.doctorId);

        if (!doctorProfile) {
          throw ApiError.notFound('Doctor not found in this hospital');
        }
      }

      updateData.doctorId = appointmentData.doctorId;
      updateData.doctorName = appointmentData.doctorName || existingData.doctorName;
    }

    if (appointmentData?.rescheduleDate && appointmentData?.rescheduleTime) {
      updateData.date = appointmentData.rescheduleDate;
      updateData.time = appointmentData.rescheduleTime;
      updateData.status = 'scheduled';
      updateData.rescheduledAt = new Date().toISOString();
      updateData.rescheduledBy = userProfile?.userId;
    }

    await this.appointmentRepository.updateAppointment(appointmentId, updateData);

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
      status: 'cancelled',
      deletedBy: userProfile?.userId,
      deletedByRole: userRole,
    });

    return {
      success: true,
      message: 'Appointment deleted successfully',
      deletedBy: userRole,
    };
  }
}
