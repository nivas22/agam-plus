import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DoctorProfile, DoctorProfileDocument } from '../schemas/doctor-profile.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class DoctorRepository {
  constructor(
    @InjectModel(DoctorProfile.name) private readonly doctorModel: Model<DoctorProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async getDoctorProfileById(doctorProfileId: string) {
    const doc = await this.doctorModel.findById(doctorProfileId).lean();
    return toPlain(doc);
  }

  async getDoctorProfileByUserId(userId: string) {
    // _id is the owning user's id for this collection (see doctor-profile.schema.ts).
    const doc = await this.doctorModel.findById(userId).lean();
    return toPlain(doc);
  }

  async verifyDoctorInHospital(doctorProfileId: string, hospitalId: string): Promise<boolean> {
    const doctor = await this.getDoctorProfileById(doctorProfileId);
    return doctor !== null && (doctor as any).hospitalId === hospitalId;
  }

  async getDoctorProfileByHospitalAndUserId(hospitalId: string, userId: string) {
    const doc = await this.doctorModel.findOne({ hospitalId, userId }).lean();
    return toPlain(doc);
  }

  async getDoctorProfilesByUserIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    const docs = await this.doctorModel.find({ userId: { $in: userIds } }).lean();
    return toPlainList(docs);
  }

  async upsertDoctorProfile(userId: string, profileData: any) {
    await this.doctorModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          userId,
          ...profileData,
          updatedAt: new Date(),
        },
        // These are hospital-scoped and live only on HospitalMember; strip any
        // copy left over from before that split so `strict: false` doesn't
        // let stale legacy data linger on documents we touch.
        $unset: { availability: '', consultationFee: '', appointmentDuration: '' },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return userId;
  }

  async doctorProfileExists(userId: string): Promise<boolean> {
    const count = await this.doctorModel.countDocuments({ _id: userId });
    return count > 0;
  }

  async updateDoctorProfile(userId: string, updates: any) {
    await this.doctorModel.updateOne({ _id: userId }, { $set: { ...updates, updatedAt: new Date() } });
  }

  async getDoctorProfileWithUser(doctorId: string) {
    const doctorDoc = await this.doctorModel.findById(doctorId).lean();
    if (!doctorDoc) return null;

    const userDoc = await this.userModel.findById(doctorDoc.userId).lean();

    return { ...toPlain(doctorDoc), user: userDoc ? toPlain(userDoc) : {} };
  }

  async updateDoctorProfileByUserId(userId: string, updates: any) {
    const doc = await this.doctorModel
      .findOneAndUpdate(
        { userId },
        {
          $set: { ...updates, updatedAt: new Date() },
          // Hospital-scoped fields (see upsertDoctorProfile) shouldn't linger here either.
          $unset: { availability: '', consultationFee: '', appointmentDuration: '' },
        },
        { returnDocument: 'after' },
      )
      .lean();

    if (!doc) {
      throw new Error('Doctor profile not found');
    }

    return toPlain(doc);
  }

  async getDoctorProfilesByIds(doctorIds: string[], hospitalId?: string) {
    if (doctorIds.length === 0) return [];

    const filter: Record<string, any> = { _id: { $in: doctorIds } };
    if (hospitalId) filter.hospitalId = hospitalId;

    const docs = await this.doctorModel.find(filter).lean();
    return toPlainList(docs);
  }
}
