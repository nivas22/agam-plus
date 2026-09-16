import { Injectable } from '@nestjs/common';
import { MedicinePackRepository } from '../repositories/medicine-pack.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';

interface MedicinePackItemData {
  medicineId: string;
  medicineName: string;
  howOften: string;
  foodTiming: string;
  days: number;
  note?: string;
}

interface CreateMedicinePackData {
  name: string;
  items: MedicinePackItemData[];
}

type UpdateMedicinePackData = Partial<CreateMedicinePackData>;

@Injectable()
export class MedicinePacksService {
  constructor(
    private readonly medicinePackRepository: MedicinePackRepository,
    private readonly auditService: AuditService,
  ) {}

  // No default-seeding, unlike the medicine/charge catalogs — packs are
  // clinical/judgment content a hospital authors for itself, not a starter
  // price list or drug list every hospital needs from day one.
  async listItems(hospitalId: string, filters: { status?: string; search?: string }) {
    const items = await this.medicinePackRepository.listByHospital(hospitalId, {
      status: filters.status,
    });

    const search = filters.search?.trim().toLowerCase();
    const filtered = search
      ? items.filter((item: any) => item.name.toLowerCase().includes(search))
      : items;

    return {
      items: filtered,
      counts: {
        all: items.filter((i: any) => i.status !== 'archived').length,
        archived: items.filter((i: any) => i.status === 'archived').length,
      },
    };
  }

  async getItem(hospitalId: string, packId: string) {
    const item = await this.medicinePackRepository.getById(hospitalId, packId);
    if (!item) throw ApiError.notFound('Medicine pack not found');
    return item;
  }

  async createItem(hospitalId: string, actor: HospitalUserProfile, data: CreateMedicinePackData) {
    const item = await this.medicinePackRepository.createItem({
      hospitalId,
      name: data.name,
      items: data.items,
      status: 'active',
      createdBy: actor.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'medicine_pack.created',
      area: 'settings',
      summary: `Added "${data.name}" to medicine packs (${data.items.length} item${data.items.length === 1 ? '' : 's'})`,
    });

    return item;
  }

  async updateItem(
    hospitalId: string,
    packId: string,
    actor: HospitalUserProfile,
    updates: UpdateMedicinePackData,
  ) {
    const existing = await this.medicinePackRepository.getById(hospitalId, packId);
    if (!existing) throw ApiError.notFound('Medicine pack not found');

    const updated = await this.medicinePackRepository.updateFields(hospitalId, packId, updates);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'medicine_pack.updated',
      area: 'settings',
      summary: `Updated "${existing.name}" in medicine packs`,
    });

    return updated;
  }

  async setStatus(
    hospitalId: string,
    packId: string,
    actor: HospitalUserProfile,
    status: 'active' | 'archived',
  ) {
    const existing = await this.medicinePackRepository.getById(hospitalId, packId);
    if (!existing) throw ApiError.notFound('Medicine pack not found');

    await this.medicinePackRepository.setStatus(hospitalId, packId, status);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === 'archived' ? 'medicine_pack.archived' : 'medicine_pack.restored',
      area: 'settings',
      summary: `${status === 'archived' ? 'Archived' : 'Restored'} "${existing.name}" in medicine packs`,
    });

    return { success: true };
  }
}
