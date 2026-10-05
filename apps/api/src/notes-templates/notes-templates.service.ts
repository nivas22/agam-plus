import { Injectable } from '@nestjs/common';
import { NotesTemplateRepository } from '../repositories/notes-template.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ROLE } from '../constants';

// The two snippets the Today screen used to hard-code, so existing hospitals
// see the same chips on day one.
const DEFAULT_NOTES_TEMPLATES = [
  {
    label: 'Continue medication',
    text: 'Continuing current medication at the same dose. Review as scheduled.',
  },
  {
    label: 'Advised rest',
    text: 'Advised rest and adequate hydration. Review if symptoms persist beyond a few days.',
  },
];

interface NotesTemplateData {
  label: string;
  text: string;
  // Admin only: false keeps it personal. Doctors always create their own.
  shared?: boolean;
}

@Injectable()
export class NotesTemplatesService {
  constructor(
    private readonly notesTemplateRepository: NotesTemplateRepository,
    private readonly auditService: AuditService,
  ) {}

  // Runs at most once per hospital (counts archived templates too), mirroring
  // MedicinesService.seedDefaultsIfEmpty.
  private async seedDefaultsIfEmpty(hospitalId: string) {
    const existingCount = await this.notesTemplateRepository.countAllByHospital(hospitalId);
    if (existingCount > 0) return;

    for (const template of DEFAULT_NOTES_TEMPLATES) {
      await this.notesTemplateRepository.createItem({
        hospitalId,
        label: template.label,
        text: template.text,
        status: 'active',
      });
    }
  }

  // Admins edit hospital-wide templates; everyone edits only their own.
  private canEdit(template: any, actor: HospitalUserProfile) {
    return template.ownerUserId
      ? template.ownerUserId === actor.userId
      : actor.role === ROLE.ADMIN;
  }

  private toResponse(template: any, actor: HospitalUserProfile) {
    return {
      id: template.id,
      label: template.label,
      text: template.text,
      shared: !template.ownerUserId,
      canEdit: this.canEdit(template, actor),
    };
  }

  private async getEditable(hospitalId: string, templateId: string, actor: HospitalUserProfile) {
    const existing = await this.notesTemplateRepository.getById(hospitalId, templateId);
    if (!existing || existing.status !== 'active') {
      throw ApiError.notFound('Notes template not found');
    }
    if (!this.canEdit(existing, actor)) {
      throw ApiError.forbidden('Only hospital admins can change shared templates');
    }
    return existing;
  }

  private async logShared(
    hospitalId: string,
    actor: HospitalUserProfile,
    action: string,
    summary: string,
  ) {
    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action,
      area: 'settings',
      summary,
    });
  }

  async listItems(hospitalId: string, actor: HospitalUserProfile) {
    await this.seedDefaultsIfEmpty(hospitalId);
    const items = await this.notesTemplateRepository.listVisibleTo(hospitalId, actor.userId);
    // Hospital-wide first, then the user's own.
    const sorted = [
      ...items.filter((t) => !t.ownerUserId),
      ...items.filter((t) => t.ownerUserId),
    ];
    return { items: sorted.map((t) => this.toResponse(t, actor)) };
  }

  async createItem(hospitalId: string, actor: HospitalUserProfile, data: NotesTemplateData) {
    const shared = actor.role === ROLE.ADMIN && data.shared !== false;
    const item = await this.notesTemplateRepository.createItem({
      hospitalId,
      ...(shared ? {} : { ownerUserId: actor.userId }),
      label: data.label.trim(),
      text: data.text.trim(),
      status: 'active',
      createdBy: actor.userId,
    });

    // Personal templates are the doctor's own scratch space — only changes
    // that affect everyone go to the audit trail.
    if (shared) {
      await this.logShared(hospitalId, actor, 'notes_template.created', `Added "${item.label}" to notes templates`);
    }

    return this.toResponse(item, actor);
  }

  async updateItem(
    hospitalId: string,
    templateId: string,
    actor: HospitalUserProfile,
    updates: Partial<NotesTemplateData>,
  ) {
    const existing = await this.getEditable(hospitalId, templateId, actor);

    const fields: Record<string, string> = {};
    if (updates.label !== undefined) fields.label = updates.label.trim();
    if (updates.text !== undefined) fields.text = updates.text.trim();
    const updated = await this.notesTemplateRepository.updateFields(hospitalId, templateId, fields);

    if (!existing.ownerUserId) {
      await this.logShared(hospitalId, actor, 'notes_template.updated', `Updated "${existing.label}" in notes templates`);
    }

    return this.toResponse(updated, actor);
  }

  async removeItem(hospitalId: string, templateId: string, actor: HospitalUserProfile) {
    const existing = await this.getEditable(hospitalId, templateId, actor);

    await this.notesTemplateRepository.updateFields(hospitalId, templateId, { status: 'archived' });

    if (!existing.ownerUserId) {
      await this.logShared(hospitalId, actor, 'notes_template.removed', `Removed "${existing.label}" from notes templates`);
    }

    return { success: true };
  }
}
