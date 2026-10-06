import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotesTemplate, NotesTemplateDocument } from '../schemas/notes-template.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class NotesTemplateRepository {
  constructor(
    @InjectModel(NotesTemplate.name)
    private readonly model: Model<NotesTemplateDocument>,
  ) {}

  async createItem(data: any) {
    const doc = await this.model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, templateId: string) {
    const doc = await this.model.findOne({ _id: templateId, hospitalId }).lean();
    return toPlain(doc);
  }

  // Includes archived ones — used only to decide whether to seed defaults.
  async countAllByHospital(hospitalId: string) {
    return this.model.countDocuments({ hospitalId });
  }

  // Active hospital-wide templates plus the given user's own.
  async listVisibleTo(hospitalId: string, userId: string) {
    const docs = await this.model
      .find({
        hospitalId,
        status: 'active',
        $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }, { ownerUserId: userId }],
      })
      .sort({ createdAt: 1 })
      .lean();
    return toPlainList(docs);
  }

  async updateFields(hospitalId: string, templateId: string, updates: Record<string, any>) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: templateId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
