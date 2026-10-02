import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionPlanConfig, SubscriptionPlanConfigDocument } from '../schemas/subscription-plan-config.schema';
import { toPlain } from './mongo.util';
import {
  SUBSCRIPTION_BASE_PRICE,
  SUBSCRIPTION_BILLING_CYCLE,
  SUBSCRIPTION_DOCTOR_ADDON_PRICE,
  SUBSCRIPTION_INCLUDED_DOCTORS,
  SUBSCRIPTION_INCLUDED_STAFF,
  SUBSCRIPTION_STAFF_ADDON_PRICE,
} from '../constants';

const CONFIG_ID = 'default';

@Injectable()
export class SubscriptionPlanConfigRepository {
  constructor(
    @InjectModel(SubscriptionPlanConfig.name)
    private readonly configModel: Model<SubscriptionPlanConfigDocument>,
  ) {}

  // Seeded once, the first time it's read, from today's SUBSCRIPTION_*
  // constants — same one-time-seed idea as DEFAULT_CHARGE_CATALOG_ITEMS in
  // charge-catalog.service.ts, so pricing isn't blank before any platform
  // admin has visited the Plan pricing screen.
  async getConfig() {
    const existing = await this.configModel.findById(CONFIG_ID).lean();
    if (existing) return toPlain(existing);

    const seeded = await this.configModel.create({
      _id: CONFIG_ID,
      includedDoctors: SUBSCRIPTION_INCLUDED_DOCTORS,
      includedStaff: SUBSCRIPTION_INCLUDED_STAFF,
      basePriceMonthly: SUBSCRIPTION_BASE_PRICE[SUBSCRIPTION_BILLING_CYCLE.MONTHLY],
      basePriceAnnual: SUBSCRIPTION_BASE_PRICE[SUBSCRIPTION_BILLING_CYCLE.ANNUAL],
      doctorAddonPriceMonthly: SUBSCRIPTION_DOCTOR_ADDON_PRICE[SUBSCRIPTION_BILLING_CYCLE.MONTHLY],
      doctorAddonPriceAnnual: SUBSCRIPTION_DOCTOR_ADDON_PRICE[SUBSCRIPTION_BILLING_CYCLE.ANNUAL],
      staffAddonPriceMonthly: SUBSCRIPTION_STAFF_ADDON_PRICE[SUBSCRIPTION_BILLING_CYCLE.MONTHLY],
      staffAddonPriceAnnual: SUBSCRIPTION_STAFF_ADDON_PRICE[SUBSCRIPTION_BILLING_CYCLE.ANNUAL],
      updatedAt: new Date(),
    });
    return toPlain(seeded.toObject());
  }

  async updateConfig(data: Record<string, any>, updatedByUserId: string) {
    // Ensure the seeded doc exists first so this upsert never drops fields
    // the caller didn't pass (a partial price edit shouldn't null out the rest).
    await this.getConfig();

    const updated = await this.configModel
      .findByIdAndUpdate(
        CONFIG_ID,
        { $set: { ...data, updatedAt: new Date(), updatedByUserId } },
        { returnDocument: 'after' },
      )
      .lean();
    return toPlain(updated);
  }
}
