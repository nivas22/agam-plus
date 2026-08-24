import { Injectable } from '@nestjs/common';
import { MedicineRepository } from '../repositories/medicine.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { DEFAULT_MEDICINES } from '../constants';

interface CreateMedicineData {
  name: string;
  genericName?: string;
  classes: string[];
  form: string;
  strength?: string;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultFoodTiming?: string;
}

type UpdateMedicineData = Partial<CreateMedicineData>;

function normalizeClasses(classes: string[] | undefined): string[] {
  return (classes || [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

@Injectable()
export class MedicinesService {
  constructor(
    private readonly medicineRepository: MedicineRepository,
    private readonly auditService: AuditService,
  ) {}

  // Gives every hospital a sensible starting catalog the first time it's
  // read, instead of an empty list with nothing to prescribe from. Runs at
  // most once per hospital — subsequent reads see real items and skip this
  // entirely. Not attributed to any user/audit entry since no admin action
  // triggered it (mirrors ChargeCatalogService.seedDefaultsIfEmpty).
  private async seedDefaultsIfEmpty(hospitalId: string) {
    const existingCount = await this.medicineRepository.countAllByHospital(hospitalId);
    if (existingCount > 0) return;

    for (const defaultMedicine of DEFAULT_MEDICINES) {
      await this.medicineRepository.createItem({
        hospitalId,
        name: defaultMedicine.name,
        genericName: defaultMedicine.genericName,
        classes: defaultMedicine.classes,
        form: defaultMedicine.form,
        strength: defaultMedicine.strength,
        defaultDose: defaultMedicine.defaultDose,
        defaultFrequency: defaultMedicine.defaultFrequency,
        defaultFoodTiming: defaultMedicine.defaultFoodTiming,
        status: 'active',
      });
    }
  }

  async listItems(hospitalId: string, filters: { status?: string; search?: string }) {
    await this.seedDefaultsIfEmpty(hospitalId);

    const items = await this.medicineRepository.listByHospital(hospitalId, {
      status: filters.status,
    });

    const search = filters.search?.trim().toLowerCase();
    const filtered = search
      ? items.filter(
          (item: any) =>
            item.name.toLowerCase().includes(search) ||
            (item.genericName || '').toLowerCase().includes(search) ||
            (item.classes || []).some((c: string) => c.includes(search)),
        )
      : items;

    return {
      items: filtered,
      counts: {
        all: items.filter((i: any) => i.status !== 'archived').length,
        archived: items.filter((i: any) => i.status === 'archived').length,
      },
    };
  }

  async getItem(hospitalId: string, medicineId: string) {
    const item = await this.medicineRepository.getById(hospitalId, medicineId);
    if (!item) throw ApiError.notFound('Medicine not found');
    return item;
  }

  async createItem(hospitalId: string, actor: HospitalUserProfile, data: CreateMedicineData) {
    const item = await this.medicineRepository.createItem({
      hospitalId,
      name: data.name,
      genericName: data.genericName,
      classes: normalizeClasses(data.classes),
      form: data.form,
      strength: data.strength,
      defaultDose: data.defaultDose,
      defaultFrequency: data.defaultFrequency,
      defaultFoodTiming: data.defaultFoodTiming,
      status: 'active',
      createdBy: actor.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'medicine.created',
      area: 'settings',
      summary: `Added "${data.name}" to the medicine catalog`,
    });

    return item;
  }

  async updateItem(
    hospitalId: string,
    medicineId: string,
    actor: HospitalUserProfile,
    updates: UpdateMedicineData,
  ) {
    const existing = await this.medicineRepository.getById(hospitalId, medicineId);
    if (!existing) throw ApiError.notFound('Medicine not found');

    const fieldUpdates: Record<string, any> = { ...updates };
    if (updates.classes) fieldUpdates.classes = normalizeClasses(updates.classes);

    const updated = await this.medicineRepository.updateFields(hospitalId, medicineId, fieldUpdates);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'medicine.updated',
      area: 'settings',
      summary: `Updated "${existing.name}" in the medicine catalog`,
    });

    return updated;
  }

  async setStatus(
    hospitalId: string,
    medicineId: string,
    actor: HospitalUserProfile,
    status: 'active' | 'archived',
  ) {
    const existing = await this.medicineRepository.getById(hospitalId, medicineId);
    if (!existing) throw ApiError.notFound('Medicine not found');

    await this.medicineRepository.setStatus(hospitalId, medicineId, status);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === 'archived' ? 'medicine.archived' : 'medicine.restored',
      area: 'settings',
      summary: `${status === 'archived' ? 'Archived' : 'Restored'} "${existing.name}" in the medicine catalog`,
    });

    return { success: true };
  }
}
