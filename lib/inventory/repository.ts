import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  collections,
  emptyState,
  type Actor,
  type Audit,
  type InventoryState,
  type Attachment,
} from "./types";
import { execute, InventoryError, todayIndia } from "./engine";
import { envelopeSchema } from "./commands";

async function ensureWorkspace(workspaceId: string) {
  await prisma.inventoryWorkspace.upsert({
    where: { workspaceId },
    create: { workspaceId, revision: BigInt(0) },
    update: {},
  });
}

async function loadState(workspaceId: string): Promise<InventoryState> {
  await ensureWorkspace(workspaceId);
  const s = emptyState();
  const ws = await prisma.inventoryWorkspace.findUnique({
    where: { workspaceId },
  });
  s.revision = Number(ws?.revision ?? 0);

  const [
    vendors,
    products,
    locations,
    lots,
    balances,
    purchases,
    sales,
    transfers,
    deliveries,
    payments,
    attachments,
  ] = await Promise.all([
    prisma.inventoryVendor.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryProduct.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryLocation.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryLot.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryBalance.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryPurchase.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventorySale.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryTransfer.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryDelivery.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryPayment.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
    prisma.inventoryAttachment.findMany({ where: { workspaceId }, orderBy: { id: "asc" } }),
  ]);

  s.vendors = vendors.map((r) => r.data as unknown as InventoryState["vendors"][number]);
  s.products = products.map((r) => r.data as unknown as InventoryState["products"][number]);
  s.locations = locations.map((r) => r.data as unknown as InventoryState["locations"][number]);
  s.lots = lots.map((r) => r.data as unknown as InventoryState["lots"][number]);
  s.balances = balances.map((r) => r.data as unknown as InventoryState["balances"][number]);
  s.purchases = purchases.map((r) => r.data as unknown as InventoryState["purchases"][number]);
  s.sales = sales.map((r) => r.data as unknown as InventoryState["sales"][number]);
  s.transfers = transfers.map((r) => r.data as unknown as InventoryState["transfers"][number]);
  s.deliveries = deliveries.map((r) => r.data as unknown as InventoryState["deliveries"][number]);
  s.payments = payments.map((r) => r.data as unknown as InventoryState["payments"][number]);
  s.attachments = attachments.map((r) => r.data as unknown as InventoryState["attachments"][number]);

  return s;
}

async function saveState(
  workspaceId: string,
  before: InventoryState,
  after: InventoryState,
  audit: Audit
) {
  for (const name of collections) {
    const oldMap = new Map(before[name].map((x) => [x.id, JSON.stringify(x)]));
    for (const row of after[name]) {
      const serialized = JSON.stringify(row);
      if (oldMap.get(row.id) !== serialized) {
        const payload = row as unknown as object;
        switch (name) {
          case "vendors":
            await prisma.inventoryVendor.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "products":
            await prisma.inventoryProduct.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "locations":
            await prisma.inventoryLocation.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "lots":
            await prisma.inventoryLot.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "balances":
            await prisma.inventoryBalance.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "purchases":
            await prisma.inventoryPurchase.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "sales":
            await prisma.inventorySale.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "transfers":
            await prisma.inventoryTransfer.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "deliveries":
            await prisma.inventoryDelivery.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "payments":
            await prisma.inventoryPayment.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
          case "attachments":
            await prisma.inventoryAttachment.upsert({
              where: { workspaceId_id: { workspaceId, id: row.id } },
              create: { workspaceId, id: row.id, data: payload },
              update: { data: payload },
            });
            break;
        }
      }
    }
  }

  await prisma.inventoryWorkspace.update({
    where: { workspaceId },
    data: { revision: BigInt(after.revision) },
  });

  await prisma.inventoryAuditEvent.create({
    data: {
      workspaceId,
      id: audit.id,
      at: new Date(audit.at),
      data: audit as unknown as object,
    },
  });
}

export async function getSnapshot(actor: Actor) {
  await ensureWorkspace(actor.workspaceId);
  const state = await loadState(actor.workspaceId);
  const auditRows = await prisma.inventoryAuditEvent.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: 100,
  });

  return { state, audit: auditRows.map((r) => r.data as unknown as Audit), actor };
}

export async function postCommand(actor: Actor, body: unknown) {
  await ensureWorkspace(actor.workspaceId);
  const envelope = envelopeSchema.parse(body);
  const hash = createHash("sha256")
    .update(JSON.stringify(envelope.command))
    .digest("hex");

  const receipt = await prisma.inventoryCommandReceipt.findUnique({
    where: {
      workspaceId_requestId: {
        workspaceId: actor.workspaceId,
        requestId: envelope.requestId,
      },
    },
  });

  if (receipt) {
    if (receipt.bodyHash !== hash) {
      throw new InventoryError("Request ID reused with different contents.", 409);
    }
    return { revision: Number(receipt.revision), replayed: true };
  }

  const before = await loadState(actor.workspaceId);
  if (before.revision !== envelope.expectedRevision) {
    throw new InventoryError(
      "Inventory changed in another session. Refresh and review your form before submitting again.",
      409
    );
  }

  const { state, audit } = execute(before, envelope.command, actor, {
    id: randomUUID,
    now: new Date().toISOString(),
    today: todayIndia(),
  });

  await saveState(actor.workspaceId, before, state, audit);

  await prisma.inventoryCommandReceipt.create({
    data: {
      workspaceId: actor.workspaceId,
      requestId: envelope.requestId,
      bodyHash: hash,
      revision: BigInt(state.revision),
    },
  });

  return { revision: state.revision, replayed: false };
}

export async function addAttachment(
  actor: Actor,
  file: { name: string; mime: string; bytes: Buffer }
) {
  await ensureWorkspace(actor.workspaceId);
  const before = await loadState(actor.workspaceId);
  const state = structuredClone(before);

  const a: Attachment = {
    id: randomUUID(),
    name: file.name,
    mime: file.mime,
    size: file.bytes.length,
    createdAt: new Date().toISOString(),
  };

  state.attachments.push(a);
  state.revision++;

  const audit: Audit = {
    id: randomUUID(),
    action: "attachment.upload",
    entityId: a.id,
    actorId: actor.id,
    actorName: actor.name,
    at: a.createdAt,
    reason: "",
    changes: [{ collection: "attachments", id: a.id, before: null, after: a }],
  };

  await saveState(actor.workspaceId, before, state, audit);

  await prisma.inventoryAttachmentBytes.create({
    data: {
      workspaceId: actor.workspaceId,
      id: a.id,
      bytes: new Uint8Array(file.bytes),
    },
  });

  return { attachment: a, revision: state.revision };
}

export async function readAttachment(actor: Actor, id: string) {
  await ensureWorkspace(actor.workspaceId);
  const [meta, content] = await Promise.all([
    prisma.inventoryAttachment.findUnique({
      where: { workspaceId_id: { workspaceId: actor.workspaceId, id } },
    }),
    prisma.inventoryAttachmentBytes.findUnique({
      where: { workspaceId_id: { workspaceId: actor.workspaceId, id } },
    }),
  ]);

  if (!meta || !content) throw new InventoryError("Attachment not found.", 404);

  return {
    meta: meta.data as unknown as Attachment,
    bytes: Buffer.from(content.bytes),
  };
}

export async function auditPage(
  actor: Actor,
  before?: { at: string; id: string }
) {
  await ensureWorkspace(actor.workspaceId);
  const rows = await prisma.inventoryAuditEvent.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(before
        ? {
            at: { lt: new Date(before.at) },
          }
        : {}),
    },
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: 100,
  });

  return rows.map((r) => r.data as unknown as Audit);
}
