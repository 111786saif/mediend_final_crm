export interface Actor {
  id: string;
  name: string;
  workspaceId: string;
  permissions: Array<"read" | "write" | "admin">;
}

export type MasterKind = "vendors" | "products" | "locations";

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  location: string;
  category: string;
  gstin: string;
  archived: boolean;
}

export interface Product {
  id: string;
  name: string;
  sizes: string[];
  mrp: number;
  category: string;
  kind: string;
  minimum: number;
  archived: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  poc: string;
  locationType: string;
  archived: boolean;
}

export interface Lot {
  id: string;
  productId: string;
  size: string;
  batch: string;
  expiry: string;
  unitCost: number;
}

export interface Balance {
  id: string;
  lotId: string;
  locationId: string;
  quantity: number;
  quarantined: boolean;
}

export interface PurchaseLine {
  productId: string;
  size: string;
  batch: string;
  expiry: string;
  quantity: number;
  unitCost: number;
}

export interface Purchase {
  id: string;
  date: string;
  vendorId: string;
  locationId: string;
  gstMode: "WITH_GST" | "WITHOUT_GST";
  documentType: string;
  reference: string;
  net: number;
  tax: number;
  total: number;
  handledBy: string;
  proofId: string;
  status: "POSTED" | "VOID";
  lines: Array<{
    productId: string;
    productName: string;
    size: string;
    batch: string;
    expiry: string;
    quantity: number;
    unitCost: number;
    lotId: string;
  }>;
}

export interface SaleLine {
  balanceId: string;
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  date: string;
  locationId: string;
  billedTo: string;
  caseReference: string;
  gstMode: "WITH_GST" | "WITHOUT_GST";
  documentType: string;
  reference: string;
  net: number;
  tax: number;
  total: number;
  handledBy: string;
  proofId: string;
  status: "POSTED" | "VOID";
  lines: Array<{
    balanceId: string;
    lotId: string;
    productId: string;
    productName: string;
    size: string;
    batch: string;
    quantity: number;
    unitCost: number;
    unitPrice: number;
  }>;
}

export interface TransferLine {
  balanceId: string;
  quantity: number;
}

export interface Transfer {
  id: string;
  fromId: string;
  toId: string;
  date: string;
  caseReference: string;
  kind: string;
  notes: string;
  status: "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
  lines: Array<{
    balanceId: string;
    lotId: string;
    quantity: number;
  }>;
}

export interface Delivery {
  id: string;
  transferId: string;
  date: string;
  carrier: string;
  fee: number;
  notes: string;
  reason: string;
  voided: boolean;
}

export interface Payment {
  id: string;
  documentId: string;
  documentKind: "PURCHASE" | "SALE";
  date: string;
  amount: number;
  method: string;
  handledBy: string;
  reference: string;
  proofId: string;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface AuditChange {
  collection: string;
  id: string;
  before: unknown;
  after: unknown;
}

export interface Audit {
  id: string;
  action: string;
  entityId: string;
  actorId: string;
  actorName: string;
  at: string;
  reason: string;
  changes: AuditChange[];
}

export interface InventoryState {
  revision: number;
  vendors: Vendor[];
  products: Product[];
  locations: Location[];
  lots: Lot[];
  balances: Balance[];
  purchases: Purchase[];
  sales: Sale[];
  transfers: Transfer[];
  deliveries: Delivery[];
  payments: Payment[];
  attachments: Attachment[];
}

export interface Snapshot {
  state: InventoryState;
  audit: Audit[];
  actor: Actor;
}

export const collections = [
  "vendors",
  "products",
  "locations",
  "lots",
  "balances",
  "purchases",
  "sales",
  "transfers",
  "deliveries",
  "payments",
  "attachments",
] as const;

export function emptyState(): InventoryState {
  return {
    revision: 0,
    vendors: [],
    products: [],
    locations: [],
    lots: [],
    balances: [],
    purchases: [],
    sales: [],
    transfers: [],
    deliveries: [],
    payments: [],
    attachments: [],
  };
}
