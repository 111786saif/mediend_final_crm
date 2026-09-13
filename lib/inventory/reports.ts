import type { InventoryState } from "./types";

export interface DashboardTotals {
  onHand: number;
  inTransit: number;
  stockValue: number;
  receivable: number;
  payable: number;
}

export function dashboard(state: InventoryState): DashboardTotals {
  const onHand = state.balances
    .filter((b) => !b.quarantined)
    .reduce((a, b) => a + b.quantity, 0);

  const inTransit = state.transfers
    .filter((t) => t.status === "IN_TRANSIT")
    .reduce((a, t) => a + t.lines.reduce((lA, l) => lA + l.quantity, 0), 0);

  const stockValue = state.balances
    .filter((b) => !b.quarantined)
    .reduce((a, b) => {
      const lot = state.lots.find((l) => l.id === b.lotId);
      return a + b.quantity * (lot?.unitCost ?? 0);
    }, 0);

  const salesPaid = state.payments
    .filter((p) => p.documentKind === "SALE")
    .reduce((map, p) => map.set(p.documentId, (map.get(p.documentId) ?? 0) + p.amount), new Map<string, number>());

  const receivable = state.sales
    .filter((s) => s.status === "POSTED")
    .reduce((a, s) => a + Math.max(0, s.total - (salesPaid.get(s.id) ?? 0)), 0);

  const purchasesPaid = state.payments
    .filter((p) => p.documentKind === "PURCHASE")
    .reduce((map, p) => map.set(p.documentId, (map.get(p.documentId) ?? 0) + p.amount), new Map<string, number>());

  const payable = state.purchases
    .filter((p) => p.status === "POSTED")
    .reduce((a, p) => a + Math.max(0, p.total - (purchasesPaid.get(p.id) ?? 0)), 0);

  return { onHand, inTransit, stockValue, receivable, payable };
}

export interface ProfitRow {
  productId: string;
  name: string;
  size: string;
  batch: string;
  quantity: number;
  cost: number;
  revenue: number;
  profit: number;
  margin: number | null;
}

export interface ProfitReport {
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  rows: ProfitRow[];
}

export function profitReport(
  state: InventoryState,
  filter?: { from?: string; to?: string; productId?: string },
): ProfitReport {
  const map = new Map<string, ProfitRow>();

  for (const sale of state.sales) {
    if (sale.status === "VOID") continue;
    if (filter?.from && sale.date < filter.from) continue;
    if (filter?.to && sale.date > filter.to) continue;

    for (const line of sale.lines) {
      if (filter?.productId && line.productId !== filter.productId) continue;

      const key = `${line.productId}::${line.size}::${line.batch}`;
      const existing = map.get(key) ?? {
        productId: line.productId,
        name: line.productName,
        size: line.size,
        batch: line.batch,
        quantity: 0,
        cost: 0,
        revenue: 0,
        profit: 0,
        margin: null,
      };

      existing.quantity += line.quantity;
      existing.cost += line.quantity * line.unitCost;
      existing.revenue += line.quantity * line.unitPrice;
      existing.profit = existing.revenue - existing.cost;
      existing.margin = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : null;

      map.set(key, existing);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  const revenue = rows.reduce((a, r) => a + r.revenue, 0);
  const cost = rows.reduce((a, r) => a + r.cost, 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;

  return { revenue, cost, profit, margin, rows };
}

export interface DeliveryReport {
  total: number;
  rows: Array<{
    id: string;
    transferId: string;
    date: string;
    carrier: string;
    fee: number;
    notes: string;
  }>;
}

export function deliveryReport(
  state: InventoryState,
  filter?: { from?: string; to?: string },
): DeliveryReport {
  const rows = state.deliveries
    .filter((d) => !d.voided)
    .filter((d) => (!filter?.from || d.date >= filter.from) && (!filter?.to || d.date <= filter.to))
    .map((d) => ({
      id: d.id,
      transferId: d.transferId,
      date: d.date,
      carrier: d.carrier,
      fee: d.fee,
      notes: d.notes,
    }));

  const total = rows.reduce((a, r) => a + r.fee, 0);
  return { total, rows };
}
