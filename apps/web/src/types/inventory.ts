// Mirrors INVENTORY_CATEGORY / INVENTORY_MOVEMENT_TYPE in
// apps/api/src/constants.ts — keep in sync.
export type InventoryCategory =
  | "medicines"
  | "consumables"
  | "surgical"
  | "lab"
  | "equipment"
  | "housekeeping"
  | "stationery"
  | "other";

export const INVENTORY_CATEGORY_OPTIONS: {
  value: InventoryCategory;
  label: string;
}[] = [
  { value: "medicines", label: "Medicines" },
  { value: "consumables", label: "Consumables" },
  { value: "surgical", label: "Surgical" },
  { value: "lab", label: "Lab supplies" },
  { value: "equipment", label: "Equipment" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "stationery", label: "Stationery" },
  { value: "other", label: "Other" },
];

// Suggestions only — the unit is free text.
export const INVENTORY_UNIT_SUGGESTIONS = [
  "piece",
  "strip",
  "box",
  "bottle",
  "vial",
  "ampoule",
  "tube",
  "pack",
  "roll",
  "pair",
  "ml",
  "litre",
  "kg",
  "ream",
];

export type InventoryMovementType =
  | "received"
  | "issued"
  | "adjusted"
  | "expired"
  | "damaged"
  | "returned";

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> =
  {
    received: "Received",
    issued: "Issued",
    adjusted: "Count corrected",
    expired: "Written off · expired",
    damaged: "Written off · damaged",
    returned: "Returned to supplier",
  };

export type InventoryStockStatus = "ok" | "low" | "out";
export type InventoryExpiryStatus = "expired" | "expiring" | null;

export interface InventoryBatch {
  id: string;
  itemId: string;
  batchNumber?: string;
  expiryDate?: string;
  quantityReceived: number;
  quantity: number;
  unitCost?: number;
  supplier?: string;
  invoiceNumber?: string;
  receivedAt: string;
  receivedByName?: string;
  expiryStatus: InventoryExpiryStatus;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  unit?: string;
  batchId: string;
  batchNumber?: string;
  expiryDate?: string;
  type: InventoryMovementType;
  quantity: number;
  batchBalanceAfter: number;
  groupId?: string;
  issuedTo?: string;
  reason?: string;
  at: string;
  actorName?: string;
}

export interface InventoryItem {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  category: InventoryCategory;
  unit: string;
  reorderLevel: number;
  tracksExpiry: boolean;
  location?: string;
  notes?: string;
  status: "active" | "archived";
  onHand: number;
  stockValue: number;
  batchCount: number;
  nearestExpiry: string | null;
  stockStatus: InventoryStockStatus;
  expiryStatus: InventoryExpiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemDetail extends InventoryItem {
  batches: InventoryBatch[];
  movements: InventoryMovement[];
}

export interface InventoryListResponse {
  items: InventoryItem[];
  counts: Record<string, number>;
}

export interface InventorySummary {
  activeItems: number;
  lowStock: number;
  outOfStock: number;
  expiringBatches: number;
  expiredBatches: number;
  stockValue: number;
  expiryWarningDays: number;
}

export interface ExpiringBatch extends InventoryBatch {
  itemName: string;
  itemCode?: string;
  unit?: string;
}

export interface InventoryItemData {
  name: string;
  category: InventoryCategory;
  unit: string;
  reorderLevel: number;
  tracksExpiry: boolean;
  location?: string;
  notes?: string;
}

export interface ReceiveStockData {
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  unitCost?: number;
  supplier?: string;
  invoiceNumber?: string;
  note?: string;
}

export interface IssueStockData {
  quantity: number;
  batchId?: string;
  issuedTo?: string;
  note?: string;
}

export type AdjustBatchData =
  | { type: "adjusted"; countedQuantity: number; reason: string }
  | {
      type: "expired" | "damaged" | "returned";
      quantity: number;
      reason?: string;
    };

// Stock changes can come back 202 — queued for an admin's approval under
// Roles & permissions — instead of happening straight away.
export interface InventoryMutationResult {
  requiresApproval: boolean;
}
