import { z } from "zod";

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vendor.save"),
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Vendor name is required.").max(150),
    phone: z.string().max(50).default(""),
    location: z.string().max(150).default(""),
    category: z.string().max(100).default(""),
    gstin: z.string().max(20).default(""),
  }),
  z.object({
    type: z.literal("product.save"),
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Implant / product name is required.").max(150),
    sizes: z.array(z.string().min(1)).min(1, "Enter at least one size."),
    mrp: z.number().int().nonnegative(),
    category: z.string().max(100).default(""),
    kind: z.string().max(50).default("IMPLANT"),
    minimum: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("location.save"),
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Location name is required.").max(150),
    address: z.string().max(300).default(""),
    phone: z.string().max(50).default(""),
    poc: z.string().max(100).default(""),
    locationType: z.string().max(50).default("HOSPITAL"),
  }),
  z.object({
    type: z.literal("purchase.post"),
    vendorId: z.string().uuid(),
    locationId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gstMode: z.enum(["WITH_GST", "WITHOUT_GST"]),
    documentType: z.string().min(1),
    reference: z.string().max(100),
    tax: z.number().int().nonnegative(),
    paidNow: z.number().int().nonnegative(),
    method: z.string().min(1),
    handledBy: z.string().min(1),
    proofId: z.string().max(100).default(""),
    lines: z
      .array(
        z.object({
          productId: z.string().uuid(),
          size: z.string().min(1),
          batch: z.string().min(1),
          expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          quantity: z.number().int().positive(),
          unitCost: z.number().int().nonnegative(),
        }),
      )
      .min(1, "Add at least one purchase item."),
  }),
  z.object({
    type: z.literal("sale.post"),
    locationId: z.string().uuid(),
    billedTo: z.string().min(1),
    caseReference: z.string().max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gstMode: z.enum(["WITH_GST", "WITHOUT_GST"]),
    documentType: z.string().min(1),
    reference: z.string().max(100),
    tax: z.number().int().nonnegative(),
    paidNow: z.number().int().nonnegative(),
    method: z.string().min(1),
    handledBy: z.string().min(1),
    proofId: z.string().max(100).default(""),
    lines: z
      .array(
        z.object({
          balanceId: z.string().uuid(),
          quantity: z.number().int().positive(),
          unitPrice: z.number().int().nonnegative(),
        }),
      )
      .min(1, "Add at least one sale item."),
  }),
  z.object({
    type: z.literal("transfer.dispatch"),
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    caseReference: z.string().max(100).default(""),
    kind: z.string().min(1),
    notes: z.string().max(500).default(""),
    fee: z.number().int().nonnegative().default(0),
    carrier: z.string().max(100).default(""),
    lines: z
      .array(
        z.object({
          balanceId: z.string().uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1, "Add at least one transfer item."),
  }),
  z.object({
    type: z.literal("transfer.receive"),
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    type: z.literal("transfer.cancel"),
    id: z.string().uuid(),
    reason: z.string().min(1, "Reason is required."),
  }),
  z.object({
    type: z.literal("payment.post"),
    documentId: z.string().uuid(),
    documentKind: z.enum(["PURCHASE", "SALE"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().int().positive(),
    method: z.string().min(1),
    handledBy: z.string().min(1),
    reference: z.string().max(100).default(""),
    proofId: z.string().max(100).default(""),
  }),
  z.object({
    type: z.literal("delivery.save"),
    id: z.string().uuid(),
    fee: z.number().int().nonnegative(),
    carrier: z.string().max(100).default(""),
    notes: z.string().max(500).default(""),
    reason: z.string().default(""),
  }),
  z.object({
    type: z.literal("delivery.void"),
    id: z.string().uuid(),
    reason: z.string().min(1, "Reason is required."),
  }),
  z.object({
    type: z.literal("stock.adjust"),
    balanceId: z.string().uuid(),
    quantity: z.number().int().nonnegative(),
    reason: z.string().min(1, "Reason is required for inventory adjustments."),
  }),
  z.object({
    type: z.literal("stock.quarantine"),
    balanceId: z.string().uuid(),
    quarantined: z.boolean(),
    reason: z.string().min(1, "Reason is required."),
  }),
  z.object({
    type: z.literal("master.archive"),
    kind: z.enum(["vendors", "products", "locations"]),
    id: z.string().uuid(),
    archived: z.boolean(),
    reason: z.string().min(1, "Reason is required."),
  }),
  z.object({
    type: z.literal("document.void"),
    id: z.string().uuid(),
    documentKind: z.enum(["PURCHASE", "SALE"]),
    reason: z.string().min(1, "Reason for voiding is required."),
  }),
]);

export type Command = z.infer<typeof commandSchema>;

export const envelopeSchema = z.object({
  requestId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  command: commandSchema,
});
