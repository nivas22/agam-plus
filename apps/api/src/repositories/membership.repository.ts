import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HospitalMember, HospitalMemberDocument } from '../schemas/hospital-member.schema';
import { Hospital, HospitalDocument } from '../schemas/hospital.schema';
import { toPlain, toPlainList, toSnapshot } from './mongo.util';

@Injectable()
export class MembershipRepository {
  constructor(
    @InjectModel(HospitalMember.name) private readonly memberModel: Model<HospitalMemberDocument>,
    @InjectModel(Hospital.name) private readonly hospitalModel: Model<HospitalDocument>,
  ) {}

  async getUserHospitalMemberships(userId: string, status?: string) {
    const filter: Record<string, any> = { userId };
    if (status) filter.status = status;

    const docs = await this.memberModel.find(filter).lean();
    return toPlainList(docs);
  }

  async getHospitalMembership(hospitalId: string, userId: string) {
    const doc = await this.memberModel.findOne({ userId, hospitalId }).lean();
    return toSnapshot(doc);
  }

  async getHospitalMembershipData(userId: string, hospitalId: string) {
    const doc = await this.memberModel.findOne({ userId, hospitalId }).lean();
    return toPlain(doc);
  }

  async getUserHospitalRole(userId: string, hospitalId: string): Promise<string | null> {
    try {
      const doc = await this.memberModel.findOne({ userId, hospitalId, status: 'approved' }).lean();
      return doc?.role || null;
    } catch (error) {
      console.error('Error checking user role', error);
      return null;
    }
  }

  async getHospitalMembers(hospitalId: string, options?: { status?: string; role?: string }) {
    const filter: Record<string, any> = { hospitalId };
    if (options?.status) filter.status = options.status;
    if (options?.role) filter.role = options.role;

    const docs = await this.memberModel.find(filter).lean();
    return toPlainList(docs);
  }

  async createHospitalMembership(membershipData: any) {
    const doc = await this.memberModel.create({
      ...membershipData,
      joinedAt: new Date(),
    });
    return doc._id.toString();
  }

  async updateHospitalMembership(membershipId: string, updates: any) {
    await this.memberModel.updateOne({ _id: membershipId }, { $set: { ...updates, updatedAt: new Date() } });
  }

  async getUserHospitalsWithDetails(
    userId: string,
    options?: { formatJoinedAt?: (value: any) => any; includeAvailability?: boolean },
  ) {
    const memberships = await this.getUserHospitalMemberships(userId);
    if (memberships.length === 0) return [];

    const hospitalIds = [...new Set(memberships.map((m: any) => m.hospitalId).filter(Boolean))];
    const hospitalDocs = await this.hospitalModel.find({ _id: { $in: hospitalIds } }).lean();
    const hospitalsById = new Map(hospitalDocs.map((doc) => [String(doc._id), toPlain(doc)]));

    const hospitals: any[] = [];
    for (const member of memberships as any[]) {
      if (!member.hospitalId) continue;
      const hospital = hospitalsById.get(member.hospitalId);
      if (!hospital) continue;

      const hospitalInfo: any = {
        id: member.id,
        hospitalId: member.hospitalId,
        hospital,
        role: member.role,
        status: member.status,
        joinedAt: options?.formatJoinedAt ? options.formatJoinedAt(member.joinedAt) : member.joinedAt,
        isDoctor: member.isDoctor || false,
        isProfileUpdated: member.isProfileUpdated || false,
        isExperienceUpdated: member.isExperienceUpdated || false,
        userId: member.userId,
      };

      if (options?.includeAvailability) {
        hospitalInfo.isAvailabilityUpdated = member.isAvailabilityUpdated || false;
      }

      hospitals.push(hospitalInfo);
    }

    return hospitals;
  }

  async getHospitalMembershipById(membershipId: string) {
    const doc = await this.memberModel.findById(membershipId).lean();
    return toPlain(doc);
  }

  async updateHospitalMembershipStatus(membershipId: string, status: string) {
    await this.memberModel.updateOne(
      { _id: membershipId },
      {
        $set: {
          status,
          updatedAt: new Date(),
          ...(status === 'approved' && { approvedAt: new Date() }),
        },
      },
    );
  }

  async deleteHospitalMembership(hospitalId: string, userId: string) {
    await this.memberModel.deleteOne({ hospitalId, userId });
  }

  async countHospitalMembers(criteria: { hospitalId: string; role?: string; status?: string }) {
    const filter: Record<string, any> = { hospitalId: criteria.hospitalId };
    if (criteria.role) filter.role = criteria.role;
    if (criteria.status) filter.status = criteria.status;

    return this.memberModel.countDocuments(filter);
  }
}
