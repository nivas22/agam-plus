import { CHARGE_CATALOG_CATEGORY_OPTIONS } from "@/constants";

export type ChargeCatalogCategory =
  | "procedures"
  | "injections"
  | "consumables"
  | "lab_diagnostics"
  | "other";

export type ChargeCatalogStatus = "active" | "archived";

export { CHARGE_CATALOG_CATEGORY_OPTIONS };

export interface ChargeCatalogPriceVersion {
  price: number;
  gstPercent: number;
  effectiveFrom: string;
  createdAt: string;
  createdByUserId?: string;
  createdByName?: string;
}

export interface ChargeCatalogItem {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  category: ChargeCatalogCategory;
  status: ChargeCatalogStatus;
  frontDeskCanAdd: boolean;
  coveredByPackages: boolean;
  priceHistory: ChargeCatalogPriceVersion[];
  currentPrice: number;
  currentGstPercent: number;
  scheduledPrice: number | null;
  scheduledEffectiveFrom: string | null;
  usageThisMonth: number;
  lastChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeCatalogListResponse {
  items: ChargeCatalogItem[];
  counts: Record<string, number>;
}

export interface CreateChargeCatalogItemData {
  name: string;
  category: ChargeCatalogCategory;
  price: number;
  gstPercent: number;
  frontDeskCanAdd: boolean;
  coveredByPackages: boolean;
}

export interface UpdateChargeCatalogItemData {
  name?: string;
  category?: ChargeCatalogCategory;
  frontDeskCanAdd?: boolean;
  coveredByPackages?: boolean;
  price?: number;
  gstPercent?: number;
  effectiveFrom?: string;
}

export type BulkReviseMethod = "percent" | "fixed" | "manual";

export interface BulkReviseChargeCatalogData {
  itemIds: string[];
  method: BulkReviseMethod;
  value?: number;
  roundTo: "none" | "5" | "10";
  effectiveFrom: string;
  manualPrices?: Record<string, number>;
}

export interface BulkReviseChargeCatalogResult {
  changes: { id: string; name: string; oldPrice: number; newPrice: number }[];
  packageCoveredCount: number;
}
