import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RolePermission, RolePermissionDocument } from '../schemas/role-permission.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class RolePermissionRepository {
  constructor(
    @InjectModel(RolePermission.name) private readonly model: Model<RolePermissionDocument>,
  ) {}

  async getByHospitalAndRole(hospitalId: string, role: string) {
    const doc = await this.model.findOne({ hospitalId, role }).lean();
    return toPlain(doc);
  }

  async getAllForHospital(hospitalId: string) {
    const docs = await this.model.find({ hospitalId }).lean();
    return toPlainList(docs);
  }

  async upsert(
    hospitalId: string,
    role: string,
    data: { overrides: Record<string, string>; discountCapAmount?: number; updatedBy: string },
  ) {
    await this.model.updateOne(
      { hospitalId, role },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true },
    );
  }
}
