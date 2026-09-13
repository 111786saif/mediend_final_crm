import type { Actor, Audit, InventoryState } from "./types";
import type { Command } from "./commands";

export class InventoryError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

export function todayIndia(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
}

export function paid(state: InventoryState, documentId: string): number {
  return state.payments
    .filter((p) => p.documentId === documentId)
    .reduce((a, p) => a + p.amount, 0);
}

export function execute(
  prev: InventoryState,
  cmd: Command,
  actor: Actor,
  ctx: { id: () => string; now: string; today: string },
): { state: InventoryState; audit: Audit } {
  const next = structuredClone(prev);
  next.revision++;
  const reason = "reason" in cmd && typeof cmd.reason === "string" ? cmd.reason : "";
  const changes: Audit["changes"] = [];

  switch (cmd.type) {
    case "vendor.save": {
      const id = cmd.id || ctx.id();
      const existing = next.vendors.find((v) => v.id === id);
      const row = {
        id,
        name: cmd.name.trim(),
        phone: cmd.phone.trim(),
        location: cmd.location.trim(),
        category: cmd.category.trim(),
        gstin: cmd.gstin.trim(),
        archived: existing?.archived ?? false,
      };
      if (existing) Object.assign(existing, row);
      else next.vendors.push(row);
      changes.push({ collection: "vendors", id, before: existing || null, after: row });
      break;
    }

    case "product.save": {
      const id = cmd.id || ctx.id();
      const existing = next.products.find((p) => p.id === id);
      const row = {
        id,
        name: cmd.name.trim(),
        sizes: Array.from(new Set(cmd.sizes.map((s) => s.trim()))),
        mrp: cmd.mrp,
        category: cmd.category.trim(),
        kind: cmd.kind.trim(),
        minimum: cmd.minimum,
        archived: existing?.archived ?? false,
      };
      if (existing) Object.assign(existing, row);
      else next.products.push(row);
      changes.push({ collection: "products", id, before: existing || null, after: row });
      break;
    }

    case "location.save": {
      const id = cmd.id || ctx.id();
      const existing = next.locations.find((l) => l.id === id);
      const row = {
        id,
        name: cmd.name.trim(),
        address: cmd.address.trim(),
        phone: cmd.phone.trim(),
        poc: cmd.poc.trim(),
        locationType: cmd.locationType.trim(),
        archived: existing?.archived ?? false,
      };
      if (existing) Object.assign(existing, row);
      else next.locations.push(row);
      changes.push({ collection: "locations", id, before: existing || null, after: row });
      break;
    }

    case "purchase.post": {
      const vendor = next.vendors.find((v) => v.id === cmd.vendorId && !v.archived);
      if (!vendor) throw new InventoryError("Select a valid, active vendor.");
      const loc = next.locations.find((l) => l.id === cmd.locationId && !l.archived);
      if (!loc) throw new InventoryError("Select a valid, active receiving location.");
      if (cmd.date > ctx.today) throw new InventoryError("Purchase date cannot be in the future.");

      let net = 0;
      const lines = cmd.lines.map((l) => {
        const product = next.products.find((p) => p.id === l.productId && !p.archived);
        if (!product) throw new InventoryError("Selected implant catalog entry is invalid or deleted.");
        if (!product.sizes.includes(l.size)) throw new InventoryError(`Size ${l.size} is not configured for ${product.name}.`);
        if (l.expiry <= ctx.today) throw new InventoryError(`Expiry date for ${product.name} must be after today.`);

        let lot = next.lots.find(
          (lot) => lot.productId === l.productId && lot.size === l.size && lot.batch === l.batch && lot.expiry === l.expiry && lot.unitCost === l.unitCost
        );
        if (!lot) {
          lot = {
            id: ctx.id(),
            productId: l.productId,
            size: l.size,
            batch: l.batch,
            expiry: l.expiry,
            unitCost: l.unitCost,
          };
          next.lots.push(lot);
          changes.push({ collection: "lots", id: lot.id, before: null, after: lot });
        }

        let balance = next.balances.find((b) => b.lotId === lot.id && b.locationId === loc.id);
        const beforeBalance = balance ? structuredClone(balance) : null;
        if (!balance) {
          balance = { id: ctx.id(), lotId: lot.id, locationId: loc.id, quantity: 0, quarantined: false };
          next.balances.push(balance);
        }
        balance.quantity += l.quantity;
        changes.push({ collection: "balances", id: balance.id, before: beforeBalance, after: balance });

        const lineNet = l.quantity * l.unitCost;
        net += lineNet;
        return {
          productId: l.productId,
          productName: product.name,
          size: l.size,
          batch: l.batch,
          expiry: l.expiry,
          quantity: l.quantity,
          unitCost: l.unitCost,
          lotId: lot.id,
        };
      });

      const total = net + (cmd.gstMode === "WITH_GST" ? cmd.tax : 0);
      if (cmd.paidNow > total) throw new InventoryError("Initial payment cannot exceed invoice total.");

      const purchaseId = ctx.id();
      const purchaseRow = {
        id: purchaseId,
        date: cmd.date,
        vendorId: cmd.vendorId,
        locationId: cmd.locationId,
        gstMode: cmd.gstMode,
        documentType: cmd.documentType,
        reference: cmd.reference,
        net,
        tax: cmd.gstMode === "WITH_GST" ? cmd.tax : 0,
        total,
        handledBy: cmd.handledBy,
        proofId: cmd.proofId,
        status: "POSTED" as const,
        lines,
      };
      next.purchases.push(purchaseRow);
      changes.push({ collection: "purchases", id: purchaseId, before: null, after: purchaseRow });

      if (cmd.paidNow > 0) {
        const paymentRow = {
          id: ctx.id(),
          documentId: purchaseId,
          documentKind: "PURCHASE" as const,
          date: cmd.date,
          amount: cmd.paidNow,
          method: cmd.method,
          handledBy: cmd.handledBy,
          reference: cmd.reference,
          proofId: cmd.proofId,
        };
        next.payments.push(paymentRow);
        changes.push({ collection: "payments", id: paymentRow.id, before: null, after: paymentRow });
      }
      break;
    }

    case "sale.post": {
      const loc = next.locations.find((l) => l.id === cmd.locationId && !l.archived);
      if (!loc) throw new InventoryError("Select a valid location.");
      if (cmd.date > ctx.today) throw new InventoryError("Sale date cannot be in the future.");

      let net = 0;
      const lines = cmd.lines.map((l) => {
        const balance = next.balances.find((b) => b.id === l.balanceId);
        if (!balance || balance.locationId !== loc.id) throw new InventoryError("Selected stock batch is not available at this location.");
        if (balance.quarantined) throw new InventoryError("Quarantined stock cannot be sold.");
        if (balance.quantity < l.quantity) throw new InventoryError("Insufficient stock in selected batch.");

        const lot = next.lots.find((lot) => lot.id === balance.lotId)!;
        if (lot.expiry < ctx.today) throw new InventoryError(`Expired batch ${lot.batch} cannot be sold.`);

        const product = next.products.find((p) => p.id === lot.productId)!;
        const beforeBalance = structuredClone(balance);
        balance.quantity -= l.quantity;
        changes.push({ collection: "balances", id: balance.id, before: beforeBalance, after: balance });

        net += l.quantity * l.unitPrice;
        return {
          balanceId: l.balanceId,
          lotId: lot.id,
          productId: product.id,
          productName: product.name,
          size: lot.size,
          batch: lot.batch,
          quantity: l.quantity,
          unitCost: lot.unitCost,
          unitPrice: l.unitPrice,
        };
      });

      const total = net + (cmd.gstMode === "WITH_GST" ? cmd.tax : 0);
      if (cmd.paidNow > total) throw new InventoryError("Initial collection cannot exceed invoice total.");

      const saleId = ctx.id();
      const saleRow = {
        id: saleId,
        date: cmd.date,
        locationId: cmd.locationId,
        billedTo: cmd.billedTo,
        caseReference: cmd.caseReference,
        gstMode: cmd.gstMode,
        documentType: cmd.documentType,
        reference: cmd.reference,
        net,
        tax: cmd.gstMode === "WITH_GST" ? cmd.tax : 0,
        total,
        handledBy: cmd.handledBy,
        proofId: cmd.proofId,
        status: "POSTED" as const,
        lines,
      };
      next.sales.push(saleRow);
      changes.push({ collection: "sales", id: saleId, before: null, after: saleRow });

      if (cmd.paidNow > 0) {
        const paymentRow = {
          id: ctx.id(),
          documentId: saleId,
          documentKind: "SALE" as const,
          date: cmd.date,
          amount: cmd.paidNow,
          method: cmd.method,
          handledBy: cmd.handledBy,
          reference: cmd.reference,
          proofId: cmd.proofId,
        };
        next.payments.push(paymentRow);
        changes.push({ collection: "payments", id: paymentRow.id, before: null, after: paymentRow });
      }
      break;
    }

    case "transfer.dispatch": {
      if (cmd.fromId === cmd.toId) throw new InventoryError("Source and destination locations must be different.");
      const from = next.locations.find((l) => l.id === cmd.fromId && !l.archived);
      const to = next.locations.find((l) => l.id === cmd.toId && !l.archived);
      if (!from || !to) throw new InventoryError("Select valid active locations for transfer.");

      const lines = cmd.lines.map((l) => {
        const balance = next.balances.find((b) => b.id === l.balanceId);
        if (!balance || balance.locationId !== from.id) throw new InventoryError("Stock batch is not present at source location.");
        if (balance.quarantined) throw new InventoryError("Quarantined items cannot be transferred.");
        if (balance.quantity < l.quantity) throw new InventoryError("Insufficient quantity available for transfer.");

        const before = structuredClone(balance);
        balance.quantity -= l.quantity;
        changes.push({ collection: "balances", id: balance.id, before, after: balance });

        return { balanceId: l.balanceId, lotId: balance.lotId, quantity: l.quantity };
      });

      const transferId = ctx.id();
      const transferRow = {
        id: transferId,
        fromId: cmd.fromId,
        toId: cmd.toId,
        date: cmd.date,
        caseReference: cmd.caseReference,
        kind: cmd.kind,
        notes: cmd.notes,
        status: "IN_TRANSIT" as const,
        lines,
      };
      next.transfers.push(transferRow);
      changes.push({ collection: "transfers", id: transferId, before: null, after: transferRow });

      if (cmd.fee > 0 || cmd.carrier) {
        const delRow = {
          id: ctx.id(),
          transferId,
          date: cmd.date,
          carrier: cmd.carrier,
          fee: cmd.fee,
          notes: cmd.notes,
          reason: "",
          voided: false,
        };
        next.deliveries.push(delRow);
        changes.push({ collection: "deliveries", id: delRow.id, before: null, after: delRow });
      }
      break;
    }

    case "transfer.receive": {
      const transfer = next.transfers.find((t) => t.id === cmd.id);
      if (!transfer || transfer.status !== "IN_TRANSIT") throw new InventoryError("Only in-transit transfers can be received.");

      const beforeTransfer = structuredClone(transfer);
      transfer.status = "RECEIVED";
      changes.push({ collection: "transfers", id: transfer.id, before: beforeTransfer, after: transfer });

      for (const line of transfer.lines) {
        let dest = next.balances.find((b) => b.lotId === line.lotId && b.locationId === transfer.toId);
        const beforeDest = dest ? structuredClone(dest) : null;
        if (!dest) {
          dest = { id: ctx.id(), lotId: line.lotId, locationId: transfer.toId, quantity: 0, quarantined: false };
          next.balances.push(dest);
        }
        dest.quantity += line.quantity;
        changes.push({ collection: "balances", id: dest.id, before: beforeDest, after: dest });
      }
      break;
    }

    case "transfer.cancel": {
      const transfer = next.transfers.find((t) => t.id === cmd.id);
      if (!transfer || transfer.status !== "IN_TRANSIT") throw new InventoryError("Only in-transit transfers can be cancelled.");

      const beforeTransfer = structuredClone(transfer);
      transfer.status = "CANCELLED";
      changes.push({ collection: "transfers", id: transfer.id, before: beforeTransfer, after: transfer });

      for (const line of transfer.lines) {
        const source = next.balances.find((b) => b.id === line.balanceId);
        if (source) {
          const before = structuredClone(source);
          source.quantity += line.quantity;
          changes.push({ collection: "balances", id: source.id, before, after: source });
        }
      }
      break;
    }

    case "payment.post": {
      const doc = cmd.documentKind === "PURCHASE" ? next.purchases.find((p) => p.id === cmd.documentId) : next.sales.find((s) => s.id === cmd.documentId);
      if (!doc || doc.status === "VOID") throw new InventoryError("Cannot record payment for a voided or missing document.");

      const alreadyPaid = paid(next, doc.id);
      if (alreadyPaid + cmd.amount > doc.total) throw new InventoryError(`Payment exceeds outstanding amount. Balance remaining: ${(doc.total - alreadyPaid) / 100}`);

      const paymentRow = {
        id: ctx.id(),
        documentId: cmd.documentId,
        documentKind: cmd.documentKind,
        date: cmd.date,
        amount: cmd.amount,
        method: cmd.method,
        handledBy: cmd.handledBy,
        reference: cmd.reference,
        proofId: cmd.proofId,
      };
      next.payments.push(paymentRow);
      changes.push({ collection: "payments", id: paymentRow.id, before: null, after: paymentRow });
      break;
    }

    case "delivery.save": {
      const del = next.deliveries.find((d) => d.id === cmd.id);
      if (!del || del.voided) throw new InventoryError("Cannot edit a voided delivery expense.");

      const before = structuredClone(del);
      del.fee = cmd.fee;
      del.carrier = cmd.carrier;
      del.notes = cmd.notes;
      del.reason = cmd.reason;
      changes.push({ collection: "deliveries", id: del.id, before, after: del });
      break;
    }

    case "delivery.void": {
      const del = next.deliveries.find((d) => d.id === cmd.id);
      if (!del || del.voided) throw new InventoryError("Expense is already voided.");

      const before = structuredClone(del);
      del.voided = true;
      del.reason = cmd.reason;
      changes.push({ collection: "deliveries", id: del.id, before, after: del });
      break;
    }

    case "stock.adjust": {
      const b = next.balances.find((b) => b.id === cmd.balanceId);
      if (!b) throw new InventoryError("Balance record not found.");

      const before = structuredClone(b);
      b.quantity = cmd.quantity;
      changes.push({ collection: "balances", id: b.id, before, after: b });
      break;
    }

    case "stock.quarantine": {
      const b = next.balances.find((b) => b.id === cmd.balanceId);
      if (!b) throw new InventoryError("Balance record not found.");

      const before = structuredClone(b);
      b.quarantined = cmd.quarantined;
      changes.push({ collection: "balances", id: b.id, before, after: b });
      break;
    }

    case "master.archive": {
      const list = next[cmd.kind];
      const master = (list as Array<{ id: string; archived: boolean }>).find((m) => m.id === cmd.id);
      if (!master) throw new InventoryError("Master record not found.");

      const before = structuredClone(master);
      master.archived = cmd.archived;
      changes.push({ collection: cmd.kind, id: master.id, before, after: master });
      break;
    }

    case "document.void": {
      const doc = cmd.documentKind === "PURCHASE" ? next.purchases.find((p) => p.id === cmd.id) : next.sales.find((s) => s.id === cmd.id);
      if (!doc || doc.status === "VOID") throw new InventoryError("Document is already voided or missing.");

      if (paid(next, doc.id) > 0) throw new InventoryError("Cannot void a document with recorded payments. Reverse payments first.");

      const before = structuredClone(doc);
      doc.status = "VOID";
      changes.push({ collection: cmd.documentKind === "PURCHASE" ? "purchases" : "sales", id: doc.id, before, after: doc });

      if (cmd.documentKind === "PURCHASE") {
        for (const line of (doc as typeof next.purchases[0]).lines) {
          const balance = next.balances.find((b) => b.lotId === line.lotId && b.locationId === doc.locationId);
          if (balance) {
            if (balance.quantity < line.quantity) throw new InventoryError("Cannot void purchase because stock has already been consumed or moved.");
            const beforeBal = structuredClone(balance);
            balance.quantity -= line.quantity;
            changes.push({ collection: "balances", id: balance.id, before: beforeBal, after: balance });
          }
        }
      } else {
        for (const line of (doc as typeof next.sales[0]).lines) {
          const balance = next.balances.find((b) => b.id === line.balanceId);
          if (balance) {
            const beforeBal = structuredClone(balance);
            balance.quantity += line.quantity;
            changes.push({ collection: "balances", id: balance.id, before: beforeBal, after: balance });
          }
        }
      }
      break;
    }
  }

  const audit: Audit = {
    id: ctx.id(),
    action: cmd.type,
    entityId: changes[0]?.id || "",
    actorId: actor.id,
    actorName: actor.name,
    at: ctx.now,
    reason,
    changes,
  };

  return { state: next, audit };
}
