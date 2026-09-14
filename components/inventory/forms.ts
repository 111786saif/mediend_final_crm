import type { InventoryState } from "@/lib/inventory/types";

export type FormKind =
  | "vendor"
  | "product"
  | "location"
  | "purchase"
  | "sale"
  | "transfer"
  | "receive"
  | "cancel"
  | "payment"
  | "delivery"
  | "adjust"
  | "quarantine"
  | "archive"
  | "void"
  | "deliveryVoid";

export interface FormRequest {
  kind: FormKind;
  id?: string;
  defaults?: Record<string, string>;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea" | "file" | "money";
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  required?: boolean;
}

export const titles: Record<FormKind, string> = {
  vendor: "Add / Update Vendor",
  product: "Add / Update Implant Catalog Entry",
  location: "Add / Update Hospital / Warehouse Location",
  purchase: "Receive Implant Purchase (Stock IN)",
  sale: "Record Implant Usage / Sale (Stock OUT)",
  transfer: "Dispatch Implant Transfer / Kit",
  receive: "Acknowledge Full Transfer Receipt",
  cancel: "Cancel In-Transit Transfer",
  payment: "Record Collection / Payment",
  delivery: "Update Porter / Delivery Expense",
  adjust: "Adjust Stock Quantity",
  quarantine: "Quarantine / Release Batch",
  archive: "Delete / Restore Master Record",
  void: "Void Purchase / Sale Invoice",
  deliveryVoid: "Void Delivery Expense",
};

export function initialValues(
  request: FormRequest,
  state: InventoryState,
  today: string,
): Record<string, string> {
  const defaults: Record<string, string> = {
    date: today,
    gstMode: "WITH_GST",
    documentType: "TAX_INVOICE",
    method: "UPI",
    locationType: "HOSPITAL",
    kind: "IMPLANT",
    category: "ORTHOPEDIC",
    paidNow: "0",
    tax: "0",
    minimum: "2",
    mrp: "0",
    amount: "0",
    fee: "0",
    quantity: "0",
    quarantined: "true",
    archived: "true",
    documentKind: "SALE",
    masterKind: "products",
    carrier: "Porter",
    reason: "",
    ...(request.defaults ?? {}),
  };

  const activeVendors = state.vendors.filter((v) => !v.archived);
  const activeLocations = state.locations.filter((l) => !l.archived);

  if (activeVendors.length > 0) defaults.vendorId = activeVendors[0].id;
  if (activeLocations.length > 0) {
    defaults.locationId = activeLocations[0].id;
    defaults.fromId = activeLocations[0].id;
    defaults.toId = activeLocations.length > 1 ? activeLocations[1].id : activeLocations[0].id;
  }

  if (!request.id) return defaults;

  switch (request.kind) {
    case "vendor": {
      const v = state.vendors.find((x) => x.id === request.id);
      return v ? { ...defaults, name: v.name, phone: v.phone, location: v.location, category: v.category, gstin: v.gstin } : defaults;
    }
    case "product": {
      const p = state.products.find((x) => x.id === request.id);
      return p
        ? {
            ...defaults,
            name: p.name,
            sizes: p.sizes.join(", "),
            mrp: (p.mrp / 100).toFixed(2),
            category: p.category,
            kind: p.kind,
            minimum: String(p.minimum),
          }
        : defaults;
    }
    case "location": {
      const l = state.locations.find((x) => x.id === request.id);
      return l
        ? {
            ...defaults,
            name: l.name,
            address: l.address,
            phone: l.phone,
            poc: l.poc,
            locationType: l.locationType,
          }
        : defaults;
    }
    case "delivery": {
      const d = state.deliveries.find((x) => x.id === request.id);
      return d
        ? {
            ...defaults,
            carrier: d.carrier,
            fee: (d.fee / 100).toFixed(2),
            notes: d.notes,
            reason: d.reason,
          }
        : defaults;
    }
  }

  return defaults;
}

export function formFields(kind: FormKind, state: InventoryState): FieldDef[] {
  const activeVendors = state.vendors.filter((v) => !v.archived);
  const activeLocations = state.locations.filter((l) => !l.archived);

  switch (kind) {
    case "vendor":
      return [
        { name: "name", label: "Vendor / Supplier Name" },
        { name: "phone", label: "Contact Phone", hint: "Optional. 10-digit Indian mobile number (e.g. 9876543210)", required: false },
        { name: "location", label: "City / Branch" },
        { name: "category", label: "Category", hint: "e.g. Orthopedic, Trauma, Spine" },
        { name: "gstin", label: "GSTIN", hint: "Optional. 15-character GSTIN (e.g. 07AAAAA0000A1Z5)", required: false },
      ];
    case "product":
      return [
        { name: "name", label: "Implant / Item Name" },
        { name: "sizes", label: "Sizes (comma separated)", hint: "e.g. S, M, L, XL or 10mm, 12mm, 14mm" },
        { name: "category", label: "Category", hint: "e.g. Knee, Hip, Trauma" },
        { name: "kind", label: "Type", type: "select", options: [{ value: "IMPLANT", label: "Implant" }, { value: "INSTRUMENT", label: "Instrument / Tool" }] },
        { name: "mrp", label: "MRP (₹)", type: "money", required: false },
        { name: "minimum", label: "Low-stock Alert Threshold", type: "number", hint: "Alert when quantity drops below this" },
      ];
    case "location":
      return [
        { name: "name", label: "Location Name" },
        { name: "address", label: "Address / Ward / OT" },
        { name: "poc", label: "Point of Contact" },
        { name: "phone", label: "Contact Phone", hint: "Optional. 10-digit Indian mobile number (e.g. 9876543210)", required: false },
        { name: "locationType", label: "Type", type: "select", options: [{ value: "HOSPITAL", label: "Hospital OT / Store" }, { value: "WAREHOUSE", label: "Central Warehouse" }, { value: "TRANSIT", label: "In Transit" }] },
      ];
    case "purchase":
      return [
        { name: "vendorId", label: "Vendor", type: "select", options: activeVendors.map((v) => ({ value: v.id, label: `${v.name} (${v.location || "Central"})` })) },
        { name: "locationId", label: "Receiving Location", type: "select", options: activeLocations.map((l) => ({ value: l.id, label: l.name })) },
        { name: "date", label: "Purchase Date", type: "date" },
        { name: "gstMode", label: "GST Mode", type: "select", options: [{ value: "WITH_GST", label: "With GST" }, { value: "WITHOUT_GST", label: "Without GST" }] },
        { name: "documentType", label: "Document Type", type: "select", options: [{ value: "TAX_INVOICE", label: "Tax Invoice" }, { value: "DELIVERY_CHALLAN", label: "Delivery Challan" }, { value: "CASH_MEMO", label: "Cash Memo" }] },
        { name: "reference", label: "Invoice / Bill Number", required: false },
        { name: "tax", label: "GST Amount (₹)", type: "money", required: false },
        { name: "paidNow", label: "Paid Now (₹)", type: "money", required: false },
        { name: "method", label: "Payment Method", type: "select", options: [{ value: "UPI", label: "UPI / QR" }, { value: "BANK_TRANSFER", label: "Bank Transfer (NEFT/RTGS)" }, { value: "CHEQUE", label: "Cheque" }, { value: "CASH", label: "Cash" }, { value: "CREDIT", label: "Credit (Unpaid)" }] },
        { name: "handledBy", label: "Handled By (Staff)" },
        { name: "proofId", label: "Proof / Bill Copy", type: "file", required: false },
      ];
    case "sale":
      return [
        { name: "locationId", label: "Dispatch Location", type: "select", options: activeLocations.map((l) => ({ value: l.id, label: l.name })) },
        { name: "billedTo", label: "Billed To (Patient / Hospital / Doctor)" },
        { name: "caseReference", label: "Case / IPD Reference", required: false },
        { name: "date", label: "Sale Date", type: "date" },
        { name: "gstMode", label: "GST Mode", type: "select", options: [{ value: "WITH_GST", label: "With GST" }, { value: "WITHOUT_GST", label: "Without GST" }] },
        { name: "documentType", label: "Document Type", type: "select", options: [{ value: "TAX_INVOICE", label: "Tax Invoice" }, { value: "BILL_OF_SUPPLY", label: "Bill of Supply" }] },
        { name: "reference", label: "Sale Receipt Number", required: false },
        { name: "tax", label: "GST Amount (₹)", type: "money", required: false },
        { name: "paidNow", label: "Collected Now (₹)", type: "money", required: false },
        { name: "method", label: "Collection Method", type: "select", options: [{ value: "UPI", label: "UPI / QR" }, { value: "BANK_TRANSFER", label: "Bank Transfer" }, { value: "CHEQUE", label: "Cheque" }, { value: "CASH", label: "Cash" }, { value: "CREDIT", label: "Credit (Pending)" }] },
        { name: "handledBy", label: "Handled By (Staff)" },
        { name: "proofId", label: "Proof / Slip Copy", type: "file", required: false },
      ];
    case "transfer":
      return [
        { name: "fromId", label: "Source Location", type: "select", options: activeLocations.map((l) => ({ value: l.id, label: l.name })) },
        { name: "toId", label: "Destination Location", type: "select", options: activeLocations.map((l) => ({ value: l.id, label: l.name })) },
        { name: "date", label: "Dispatch Date", type: "date" },
        { name: "caseReference", label: "Case / Doctor Reference", required: false },
        { name: "kind", label: "Transfer Type", type: "select", options: [{ value: "KIT_DISPATCH", label: "Kit Dispatch to Hospital" }, { value: "STOCK_TRANSFER", label: "Stock Relocation" }, { value: "UNUSED_RETURN", label: "Unused Return" }] },
        { name: "fee", label: "Porter / Delivery Fee (₹)", type: "money", required: false },
        { name: "carrier", label: "Delivery Carrier / Porter Name", required: false },
        { name: "notes", label: "Notes", type: "textarea", required: false },
      ];
    case "receive":
      return [
        { name: "date", label: "Receipt Date", type: "date" },
        { name: "acknowledge", label: "Confirmation", type: "select", options: [{ value: "yes", label: "Yes, I confirm all items are received intact" }, { value: "no", label: "No, discrepancy exists" }] },
      ];
    case "cancel":
      return [{ name: "reason", label: "Reason for Cancellation", type: "textarea" }];
    case "payment":
      return [
        { name: "date", label: "Payment Date", type: "date" },
        { name: "amount", label: "Amount (₹)", type: "money" },
        { name: "method", label: "Payment Method", type: "select", options: [{ value: "UPI", label: "UPI / QR" }, { value: "BANK_TRANSFER", label: "Bank Transfer (NEFT/RTGS)" }, { value: "CHEQUE", label: "Cheque" }, { value: "CASH", label: "Cash" }] },
        { name: "handledBy", label: "Handled By (Staff)" },
        { name: "reference", label: "Transaction / UTR Number", required: false },
        { name: "proofId", label: "Receipt / Proof Copy", type: "file", required: false },
      ];
    case "delivery":
      return [
        { name: "fee", label: "Delivery Expense Fee (₹)", type: "money" },
        { name: "carrier", label: "Carrier / Porter", required: false },
        { name: "notes", label: "Notes", type: "textarea", required: false },
        { name: "reason", label: "Reason for Change", required: false },
      ];
    case "adjust":
      return [
        { name: "quantity", label: "New Verified Quantity", type: "number" },
        { name: "reason", label: "Reason for Audit Adjustment", type: "textarea" },
      ];
    case "quarantine":
      return [
        { name: "quarantined", label: "Status", type: "select", options: [{ value: "true", label: "Quarantine Batch (Block Usage)" }, { value: "false", label: "Release to Available Stock" }] },
        { name: "reason", label: "Reason", type: "textarea" },
      ];
    case "archive":
      return [
        { name: "archived", label: "Action", type: "select", options: [{ value: "true", label: "Delete / Archive Master Record" }, { value: "false", label: "Restore Master Record" }] },
        { name: "reason", label: "Reason", type: "textarea" },
      ];
    case "void":
      return [{ name: "reason", label: "Reason for Voiding Invoice", type: "textarea" }];
    case "deliveryVoid":
      return [{ name: "reason", label: "Reason for Voiding Expense", type: "textarea" }];
  }
}
