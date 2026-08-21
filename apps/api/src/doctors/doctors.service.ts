import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipRepository } from '../repositories/membership.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { UserRepository } from '../repositories/user.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { EmailService } from '../email/email.service';
import { ApiError } from '../common/errors/api-error';
import { DoctorProfile, TimeSlot } from '../types/doctor';
import { ACTIVE_APPOINTMENT_STATUSES } from '../constants';

@Injectable()
export class DoctorsService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly userRepository: UserRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async getDoctors(
    hospitalId: string,
    query: {
      search?: string;
      status?: string;
      specialization?: string;
      joinedFrom?: string;
      joinedTo?: string;
      sortBy?: 'name' | 'joinedAt';
      sortOrder?: 'asc' | 'desc';
      page?: string;
      limit?: string;
    },
  ) {
    const searchFilter = query.search?.trim().toLowerCase();
    const statusFilter = query.status;
    const specializationFilter = query.specialization;
    const joinedFrom = query.joinedFrom ? new Date(query.joinedFrom) : undefined;
    const joinedTo = query.joinedTo ? new Date(query.joinedTo) : undefined;
    const sortBy = query.sortBy || 'name';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);

    // STEP 1: Get members of this hospital
    const members = await this.membershipRepository.getHospitalMembers(hospitalId, {
      status: statusFilter || undefined,
    });

    const memberUserIds = members.map((m: any) => m.userId).filter((id: string) => id);

    if (memberUserIds.length === 0) {
      return {
        doctors: [],
        total: 0,
        hospitalId,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    // STEP 2: Fetch doctor profiles using batched queries
    const doctorProfiles = await this.doctorRepository.getDoctorProfilesByUserIds(memberUserIds);

    // Filter by specialization if needed
    let filteredProfiles = doctorProfiles;

    if (specializationFilter) {
      filteredProfiles = filteredProfiles.filter((p: any) => p.specialization === specializationFilter);
    }

    // STEP 3: Fetch user documents (names, email)
    const doctors: DoctorProfile[] = [];

    for (const profile of filteredProfiles) {
      const prof = profile as any;
      const userData = await this.userRepository.getUserById(prof.userId);

      // Get this doctor's membership details (status, membershipId)
      const membershipData = members.find((m: any) => m.userId === prof.userId);

      const user = userData as any;
      const membership = membershipData as any;

      doctors.push({
        id: prof.userId,
        hospitalId: hospitalId,
        userId: prof.userId,
        membershipId: membership?.id || null,
        membershipStatus: membership.status || 'pending',
        status: membership.status || 'pending',

        // doctor profile fields
        name: prof.name || user?.name || 'Unknown Doctor',
        email: user?.email || prof.email || 'No email',
        phone: prof.phone || '',
        // specialization prefers membership but still falls back to the profile
        // (profiles created before the membership-first migration may only have
        // it there); consultationFee/availability are membership-only.
        specialization: membership.specialization || prof.specialization || null,
        qualification: prof.qualification || null,
        consultationFee: membership.consultationFee || null,
        availability: membership.availability || null,
        appointmentDuration: membership.appointmentDuration || 30,
        experience: prof.experience || null,
        bio: prof.bio || '',
        address: prof.address || '',
        joinedAt: membership.joinedAt || null,
        isAcceptingBookings: membership.isAcceptingBookings !== false,
      });
    }

    // Filter by search term (name, email, phone)
    let searchedDoctors = doctors;
    if (searchFilter) {
      searchedDoctors = searchedDoctors.filter((d: any) =>
        [d.name, d.email, d.phone].some((field) => field?.toLowerCase().includes(searchFilter)),
      );
    }

    // Filter by joinedAt date range
    if (joinedFrom || joinedTo) {
      searchedDoctors = searchedDoctors.filter((d: any) => {
        if (!d.joinedAt) return false;
        const joinedAt = new Date(d.joinedAt);
        if (joinedFrom && joinedAt < joinedFrom) return false;
        if (joinedTo && joinedAt > joinedTo) return false;
        return true;
      });
    }

    // Sort doctors by the requested field
    const sortedDoctors = searchedDoctors.sort((a: any, b: any) => {
      if (sortBy === 'joinedAt') {
        const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
        const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
        return (timeA - timeB) * sortOrder;
      }

      const nameA = a.name?.toLowerCase() || '';
      const nameB = b.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB) * sortOrder;
    });

    // Calculate pagination
    const total = sortedDoctors.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDoctors = sortedDoctors.slice(startIndex, endIndex);

    return {
      doctors: paginatedDoctors,
      total,
      hospitalId,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async createDoctor(
    hospitalId: string,
    invitedByUid: string,
    doctorData: {
      name: string;
      email: string;
      phone: string;
      specialization?: string;
      qualification?: string;
      experience?: string;
      bio?: string;
      consultationFee?: number;
      gender?: string;
      maritalStatus?: string;
      address?: string;
      status?: 'active' | 'inactive' | 'pending';
      availability?: TimeSlot[];
      appointmentDuration?: number;
    },
  ) {
    // Check if user exists by email
    const existingUser = await this.userRepository.getUserByEmail(doctorData.email);

    let doctorUserId: string;
    if (!existingUser) {
      // Create new user
      doctorUserId = await this.userRepository.createUser({
        email: doctorData.email,
        name: doctorData.name,
      });
    } else {
      doctorUserId = (existingUser as any).id;
    }

    // Check if membership already exists
    const existingMembership = await this.membershipRepository.getHospitalMembershipData(doctorUserId, hospitalId);

    if (!existingMembership) {
      // Create hospital membership with specialization and consultationFee
      await this.membershipRepository.createHospitalMembership({
        hospitalId,
        userId: doctorUserId,
        role: 'doctor',
        status: 'pending',
        invitedBy: invitedByUid,
        isAvailabilityUpdated: false,
        isExperienceUpdated: false,
        isProfileUpdated: false,
        specialization: doctorData.specialization || null,
        consultationFee: doctorData.consultationFee || null,
        isAcceptingBookings: doctorData.status !== 'inactive',
        availability: doctorData.availability || [],
        appointmentDuration: doctorData.appointmentDuration || 30,
      });
    } else {
      // Update existing membership with specialization, consultationFee, and scheduling fields if provided
      const updates: Record<string, any> = {};
      if (doctorData.specialization) updates.specialization = doctorData.specialization;
      if (doctorData.consultationFee) updates.consultationFee = doctorData.consultationFee;
      if (doctorData.availability) updates.availability = doctorData.availability;
      if (doctorData.appointmentDuration) updates.appointmentDuration = doctorData.appointmentDuration;

      if (Object.keys(updates).length > 0) {
        await this.membershipRepository.updateHospitalMembership((existingMembership as any).id, updates);
      }
    }

    // Create or update doctor profile
    const doctorProfileData = {
      phone: doctorData.phone || '',
      email: doctorData.email,
      name: doctorData.name,
      specialization: doctorData.specialization || null,
      qualification: doctorData.qualification || null,
      experience: doctorData.experience || null,
      bio: doctorData.bio || '',
      gender: doctorData.gender || null,
      maritalStatus: doctorData.maritalStatus || null,
      address: doctorData.address || '',
      createdBy: invitedByUid,
    };

    await this.doctorRepository.upsertDoctorProfile(doctorUserId, doctorProfileData);

    // Send welcome email notification to the doctor
    try {
      const hospitalName = 'Hospital';

      await this.emailService.sendDoctorWelcomeEmail(doctorData.email, doctorData.name, hospitalName);
    } catch (emailError) {
      // Log error but don't fail the request if email fails
      console.error('Failed to send welcome email:', emailError);
    }

    return {
      success: true,
      doctor: {
        id: doctorUserId,
        profileId: doctorUserId,
        userId: doctorUserId,
        hospitalId,
        name: doctorData.name,
        email: doctorData.email,
        status: 'active',
        membershipStatus: 'pending',
      },
    };
  }

  async getDoctorById(hospitalId: string, doctorId: string) {
    const doctor = await this.doctorRepository.getDoctorProfileWithUser(doctorId);

    if (!doctor) {
      throw ApiError.notFound(`Doctor not found in this hospital ${hospitalId}`);
    }

    // Get membership data to include specialization and consultationFee
    const doctorData = doctor as any;
    const membership = await this.membershipRepository.getHospitalMembershipData(doctorData.userId, hospitalId);
    const membershipData = membership as any;

    // Accepting-bookings is hospital-scoped (lives on the membership), unlike
    // DoctorProfile which is a single doc shared across every hospital the
    // doctor belongs to — fall back to the profile's status only for legacy
    // records written before this field existed.
    const acceptingBookings = membershipData?.isAcceptingBookings;
    const status = acceptingBookings === undefined ? doctorData.status || 'pending' : acceptingBookings ? 'active' : 'inactive';

    // consultationFee and availability live only on the membership now (see
    // updateDoctor's allowedFields comment) — no profile fallback to merge.
    return {
      ...doctor,
      status,
      specialization: membershipData?.specialization || doctorData.specialization,
      consultationFee: membershipData?.consultationFee,
      availability: membershipData?.availability || [],
      appointmentDuration: membershipData?.appointmentDuration || 30,
      membershipId: membershipData?.id,
      membershipStatus: membershipData?.status,
    };
  }

  async updateDoctor(hospitalId: string, doctorId: string, updates: Record<string, any>, updatedByUid: string) {
    // Get doctor profile to get userId
    const doctorProfile = await this.doctorRepository.getDoctorProfileWithUser(doctorId);
    if (!doctorProfile) {
      throw ApiError.notFound('Doctor profile not found');
    }

    // Verify membership
    const membership = await this.membershipRepository.getHospitalMembershipData(
      (doctorProfile as any).userId,
      hospitalId,
    );
    if (!membership) {
      throw ApiError.forbidden('Doctor does not belong to this hospital');
    }

    // consultationFee and availability are intentionally excluded — they're
    // hospital-scoped (a doctor's fee/hours can differ per hospital) and live
    // only on the membership below, not on the shared DoctorProfile doc.
    const allowedFields = [
      'name',
      'email',
      'phone',
      'specialization',
      'qualification',
      'bio',
      'experience',
      'address',
      'gender',
      'maritalStatus',
      'isProfileUpdated',
      'isExperienceUpdated',
      'isAvailabilityUpdated',
    ];

    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) updateData[key] = updates[key];
    }

    updateData.updatedBy = updatedByUid;

    // getDoctors/getDoctorById read email from the linked User doc first,
    // falling back to the profile — keep them in sync or the list keeps
    // showing the old email (same fix as PatientsService.updatePatient).
    if (updates.email && updates.email !== (doctorProfile as any).email) {
      await this.userRepository.updateUser((doctorProfile as any).userId, { email: updates.email });
    }

    // Update doctor profile
    await this.doctorRepository.updateDoctorProfileByUserId((doctorProfile as any).userId, updateData);

    // Prepare membership updates
    const membershipUpdates: Record<string, any> = {};

    if (updates.isProfileUpdated !== undefined) {
      membershipUpdates.isProfileUpdated = updates.isProfileUpdated;
    }
    if (updates.isExperienceUpdated !== undefined) {
      membershipUpdates.isExperienceUpdated = updates.isExperienceUpdated;
    }
    if (updates.isAvailabilityUpdated !== undefined) {
      membershipUpdates.isAvailabilityUpdated = updates.isAvailabilityUpdated;
    }

    // "Accepting bookings" is per-hospital, so it lives on the membership —
    // not on DoctorProfile, which is shared across every hospital this
    // doctor belongs to.
    if (updates.status !== undefined) {
      membershipUpdates.isAcceptingBookings = updates.status === 'active';
    }

    // specialization, consultationFee, availability, and appointmentDuration all
    // live only on the membership (see allowedFields comment above).
    if (updates.specialization !== undefined) {
      membershipUpdates.specialization = updates.specialization;
    }
    if (updates.consultationFee !== undefined) {
      membershipUpdates.consultationFee = updates.consultationFee;
    }
    if (updates.availability !== undefined) {
      membershipUpdates.availability = updates.availability;
    }
    if (updates.appointmentDuration !== undefined) {
      membershipUpdates.appointmentDuration = updates.appointmentDuration;
    }

    // Update the membership if there are any updates
    if (Object.keys(membershipUpdates).length > 0) {
      await this.membershipRepository.updateHospitalMembership((membership as any).id, membershipUpdates);
    }

    return { success: true, message: 'Doctor updated successfully' };
  }

  async deleteDoctor(hospitalId: string, doctorId: string) {
    // Remove hospital membership
    await this.membershipRepository.deleteHospitalMembership(hospitalId, doctorId);

    return {
      success: true,
      message: 'Doctor deleted successfully',
    };
  }

  async updateDoctorStatus(doctorId: string, status: string, requestingUserId: string) {
    // Validate status value
    const validStatuses = ['approved', 'pending', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }

    // Update doctor membership status
    await this.membershipRepository.updateHospitalMembershipStatus(doctorId, status);

    return {
      success: true,
      message: `Doctor status updated by ${requestingUserId} to '${status}' successfully.`,
    };
  }

  async getAvailability(hospitalId: string, doctorId: string, date?: string) {
    // Fetch doctor data
    const memberSnapshot = await this.membershipRepository.getHospitalMembership(hospitalId, doctorId);
    if (memberSnapshot.empty) {
      throw ApiError.notFound('Doctor not found in this hospital');
    }

    const memberDoc = memberSnapshot.docs[0];
    const doctorData: any = { id: memberDoc.id, ...memberDoc.data() };

    // If date is provided, return available appointment slots for that date
    if (date) {
      const availableSlots = await this.getAvailableSlots(doctorData, date);

      return {
        availableSlots,
        doctor: {
          id: doctorData.id,
          name: doctorData.name,
          specialization: doctorData.specialization,
          appointmentDuration: doctorData.appointmentDuration || 30,
        },
      };
    }

    // If no date provided, return the saved availability configuration
    const memberData: any = memberDoc.data();
    return {
      availability: doctorData.availability || [],
      appointmentDuration: doctorData.appointmentDuration || 30,
      isAvailabilityUpdated: memberData.isAvailabilityUpdated || false,
    };
  }

  async saveAvailability(
    hospitalId: string,
    doctorId: string,
    body: { availability: TimeSlot[]; appointmentDuration?: number },
  ) {
    const { availability, appointmentDuration } = body;

    if (!availability || !Array.isArray(availability)) {
      throw ApiError.badRequest('Availability array is required');
    }

    // Validate availability format
    for (const slot of availability as TimeSlot[]) {
      if (!slot.day || !slot.startTime || !slot.endTime) {
        throw ApiError.badRequest('Each availability slot must have day, startTime, and endTime');
      }
    }

    // Fetch doctor membership document
    const memberSnapshot = await this.membershipRepository.getHospitalMembership(hospitalId, doctorId);

    if (memberSnapshot.empty) {
      throw ApiError.notFound('Doctor not found in this hospital');
    }

    const memberDoc = memberSnapshot.docs[0];

    // Update doctor availability in hospital members collection
    const updateData: Record<string, any> = {
      availability,
      isAvailabilityUpdated: true,
      updatedAt: new Date(),
    };

    if (appointmentDuration) {
      updateData.appointmentDuration = appointmentDuration;
    }

    await this.membershipRepository.updateHospitalMembership(memberDoc.id, updateData);

    return {
      success: true,
      message: 'Doctor availability saved successfully',
      data: {
        doctorId,
        hospitalId,
        availability,
        appointmentDuration,
      },
    };
  }

  async getNextAvailability(hospitalId: string, doctorId: string, date: string, preferredTime?: string) {
    if (!date) {
      throw ApiError.badRequest('Date parameter is required');
    }

    // Fetch doctor data
    const memberSnapshot = await this.membershipRepository.getHospitalMembership(hospitalId, doctorId);
    if (memberSnapshot.empty) {
      throw ApiError.notFound('Doctor not found in this hospital');
    }

    const memberDoc = memberSnapshot.docs[0];
    const doctorData: any = { id: memberDoc.id, ...memberDoc.data() };

    // Find next available slot
    const nextAvailableSlot = await this.findNextAvailableSlot(doctorData, date, preferredTime);

    return {
      nextAvailableSlot,
      doctor: {
        id: doctorData.id,
        name: doctorData.name,
        specialization: doctorData.specialization,
        appointmentDuration: doctorData.appointmentDuration || 30,
      },
    };
  }

  async getDoctorProfileByUserId(hospitalId: string, userId: string) {
    // Fetch both doctor profile and membership in parallel for better performance
    const [doctorProfile, membershipRef] = await Promise.all([
      this.doctorRepository.getDoctorProfileByUserId(userId),
      this.membershipRepository.getHospitalMembership(hospitalId, userId),
    ]);

    // Check if doctor profile exists first
    if (!doctorProfile) {
      throw ApiError.notFound('Doctor profile not found');
    }

    // Check if membership exists
    if (membershipRef.empty) {
      throw ApiError.notFound('Membership not found for this hospital');
    }

    const membershipDoc = membershipRef.docs[0];
    const membership = membershipDoc.data();

    // Create combined response data
    return {
      ...doctorProfile,
      ...membership,
      hospitalId,
      userId,
      membershipId: membershipDoc.id,
    };
  }

  // Helper function to find next available slot
  private async findNextAvailableSlot(
    doctor: any,
    date: string,
    preferredTime?: string,
  ): Promise<{ date: string; time: string } | null> {
    const currentDate = new Date(date);
    let attempts = 0;
    const maxAttempts = 30; // Limit to prevent infinite loops

    while (attempts < maxAttempts) {
      // Get available slots for this date
      const slots = await this.getAvailableSlots(doctor, currentDate.toISOString().split('T')[0]);

      if (slots.length > 0) {
        // If we have a preferred time and it's available, use it
        if (preferredTime && slots.includes(preferredTime)) {
          return {
            date: currentDate.toISOString().split('T')[0],
            time: preferredTime,
          };
        }

        // Otherwise, use the first available slot
        return {
          date: currentDate.toISOString().split('T')[0],
          time: slots[0],
        };
      }

      // No slots available on this day, move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      attempts++;
    }

    // No available slots found within the attempt limit
    return null;
  }

  // Helper function to get available slots
  private async getAvailableSlots(doctor: any, date: string): Promise<string[]> {
    try {
      const doctorAvailability = doctor?.availability || [];

      // Get day of week
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

      // Check if doctor is available on this day
      const dayAvailability = doctorAvailability.find((a: any) => a.day === dayOfWeek);
      if (!dayAvailability) return [];

      // Get existing appointments using repository function
      // Include legacy 'scheduled' for appointments created before this status migration.
      const existingAppointments = await this.appointmentRepository.getAppointmentsByDoctorAndDate(doctor.id, date, [
        ...ACTIVE_APPOINTMENT_STATUSES,
        'scheduled',
      ]);

      const existingTimes = existingAppointments.map((appt: any) => appt.time);

      // Check if the date is today
      const today = new Date();
      const isToday = dateObj.toDateString() === today.toDateString();
      const currentTime = isToday ? today : null;

      // Build available slots
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

        if (!existingTimes.includes(timeString)) {
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
}
