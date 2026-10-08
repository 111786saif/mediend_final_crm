import { getSessionFromRequest, getSessionWithFreshUser } from "@/lib/session";
import {
  getSnapshot,
  postCommand,
  auditPage,
} from "@/lib/inventory/repository";
import { InventoryError } from "@/lib/inventory/engine";
import { UserRole } from "@/generated/prisma/enums";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getActor(request: Request) {
  const session = (await getSessionWithFreshUser()) || getSessionFromRequest(request);
  if (!session) {
    throw new InventoryError("Authentication required.", 401);
  }

  const role = session.role as UserRole;
  const permissions: Array<"read" | "write" | "admin"> = ["read"];

  if (
    role === "MD" ||
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "EXECUTIVE_ASSISTANT"
  ) {
    permissions.push("write", "admin");
  } else if (
    role === "FINANCE_HEAD" ||
    role === "PL_HEAD" ||
    role === "SALES_HEAD" ||
    role === "CATEGORY_MANAGER" ||
    role === "ASSISTANT_CATEGORY_MANAGER" ||
    role === "TEAM_LEAD"
  ) {
    permissions.push("write");
  }

  return {
    id: session.id,
    name: session.name || session.email || "Staff User",
    workspaceId: "default",
    permissions,
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getActor(request);
    const url = new URL(request.url);
    if (url.searchParams.has("audit")) {
      const at = url.searchParams.get("beforeAt"),
        id = url.searchParams.get("beforeId");
      const cursor =
        at && id
          ? z.object({ at: z.string().datetime(), id: z.string().uuid() }).parse({ at, id })
          : undefined;
      return Response.json(
        { audit: await auditPage(actor, cursor) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const snapshot = await getSnapshot(actor);
    const tabParam = url.searchParams.get("tab") || "";
    const filtersParam = url.searchParams.get("filters");
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam);
        if (Array.isArray(parsedFilters) && parsedFilters.length > 0) {
          const state = snapshot.state;
          for (const f of parsedFilters) {
            const { field, value } = f;
            if (!field || value === undefined || value === null || value === "") continue;

            const strVal = typeof value === "string" ? value.trim().toLowerCase() : "";

            // Sales filtering
            if (state.sales && (!tabParam || tabParam === "Sales" || tabParam === "Sales Product" || tabParam === "Sales Finance" || tabParam === "Payments")) {
              state.sales = state.sales.filter((sale) => {
                if (field === "patientName" || field === "billedTo" || field === "name") {
                  if (strVal) {
                    return `${sale.patientName || ""} ${sale.billedTo || ""}`.toLowerCase().includes(strVal);
                  }
                }
                if (field === "caseReference" || field === "caseRefNo" || field === "caseRef") {
                  if (strVal) {
                    return (sale.caseReference || "").toLowerCase().includes(strVal);
                  }
                }
                if (field === "remark" || field === "notes" || field === "details") {
                  if (strVal) {
                    return (sale.remark || "").toLowerCase().includes(strVal);
                  }
                }
                if (field === "items" || field === "item" || field === "productName" || field === "implant" || field === "batch") {
                  if (strVal) {
                    return (
                      sale.lines?.some(
                        (l) =>
                          (l.productName || "").toLowerCase().includes(strVal) ||
                          (l.batch || "").toLowerCase().includes(strVal)
                      ) || (sale.stockUsedForm || "").toLowerCase().includes(strVal)
                    );
                  }
                }
                if (field === "hospitalName" || field === "hospital" || field === "location") {
                  const hospName =
                    sale.hospitalName ||
                    state.locations.find((l) => l.id === sale.locationId)?.name ||
                    "";
                  if (strVal) {
                    return hospName.toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.some((v) => hospName.toLowerCase().includes(String(v).toLowerCase()));
                  }
                }
                if (field === "bdmName" || field === "bdm") {
                  const bdm = `${sale.bdmName || ""} ${sale.handledBy || ""}`.toLowerCase();
                  if (strVal) {
                    return bdm.includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.some((v) => bdm.includes(String(v).toLowerCase()));
                  }
                }
                if (field === "managerName" || field === "manager") {
                  if (strVal) {
                    return (sale.managerName || "").toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.some((v) => (sale.managerName || "").toLowerCase().includes(String(v).toLowerCase()));
                  }
                }
                if (field === "treatment") {
                  if (strVal) {
                    return (sale.treatment || "").toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.some((v) => (sale.treatment || "").toLowerCase().includes(String(v).toLowerCase()));
                  }
                }
                if (field === "circle") {
                  if (Array.isArray(value) && value.length > 0) {
                    return value
                      .map((v) => String(v).toLowerCase())
                      .includes((sale.circle || "").toLowerCase());
                  }
                }
                if (field === "drName" || field === "doctor") {
                  if (strVal) {
                    return (sale.drName || "").toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.some((v) => (sale.drName || "").toLowerCase().includes(String(v).toLowerCase()));
                  }
                }
                if (field === "handledBy") {
                  if (strVal) {
                    return (sale.handledBy || "").toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.includes(sale.handledBy || "");
                  }
                }
                if (field === "document" || field === "reference") {
                  if (strVal) {
                    return `${sale.reference || ""} ${sale.id || ""}`.toLowerCase().includes(strVal);
                  }
                }
                if (field === "mop" || field === "paymentType") {
                  if (Array.isArray(value) && value.length > 0) {
                    return value.includes(sale.mop || "");
                  }
                }
                if (field === "status") {
                  if (Array.isArray(value) && value.length > 0) {
                    const totalAmt = sale.total || sale.salesPriceWithGst || 0;
                    const docPayments = (state.payments || []).filter((p) => p.documentId === sale.id);
                    const paidFromPayments = docPayments.reduce((sum, p) => sum + p.amount, 0);
                    const paidAmt =
                      sale.receivedPayment !== undefined && sale.receivedPayment > 0
                        ? sale.receivedPayment
                        : paidFromPayments;

                    const isPaid =
                      (totalAmt > 0 && paidFromPayments >= totalAmt) ||
                      (totalAmt > 0 && (sale.receivedPayment || 0) >= totalAmt) ||
                      sale.paymentReceivedStatus === "Received" ||
                      sale.paymentReceivedStatus === "Payment Received";

                    const isPartPaid =
                      !isPaid &&
                      ((paidFromPayments > 0 && paidFromPayments < totalAmt) ||
                        ((sale.receivedPayment || 0) > 0 && (sale.receivedPayment || 0) < totalAmt) ||
                        sale.paymentReceivedStatus === "Part Paid" ||
                        paidAmt > 0);

                    const isUnpaid = !isPaid && !isPartPaid;
                    const paymentStatus =
                      sale.status === "VOID"
                        ? "Void"
                        : isPaid
                          ? "Paid"
                          : isPartPaid
                            ? "Part paid"
                            : "Unpaid";

                    const normValues = value.map((v) => String(v).toLowerCase().trim());
                    return (
                      value.includes(sale.status || "") ||
                      value.includes(paymentStatus) ||
                      normValues.includes(paymentStatus.toLowerCase()) ||
                      normValues.includes((sale.status || "").toLowerCase()) ||
                      (normValues.includes("unpaid") && (isUnpaid || paidFromPayments === 0)) ||
                      (normValues.includes("outstanding") && (isUnpaid || isPartPaid)) ||
                      (normValues.includes("part paid") && isPartPaid) ||
                      (normValues.includes("paid") && isPaid) ||
                      (normValues.includes("void") && (paymentStatus === "Void" || sale.status === "VOID")) ||
                      (normValues.includes("posted") && sale.status === "POSTED")
                    );
                  }
                }
                if (field === "invoiceStatus") {
                  if (Array.isArray(value) && value.length > 0) {
                    const isRaised =
                      sale.invoiceStatus === "Raised" ||
                      sale.invoiceStatus === "Invoice Raised" ||
                      Boolean(sale.reference);
                    const st = isRaised ? "Raised" : "Pending";
                    const normValues = value.map((v) => String(v).toLowerCase().trim());
                    return (
                      value.includes(st) ||
                      value.includes(sale.invoiceStatus || "") ||
                      normValues.includes(st.toLowerCase()) ||
                      normValues.includes((sale.invoiceStatus || "").toLowerCase()) ||
                      (normValues.includes("raised") && isRaised) ||
                      (normValues.includes("pending") && !isRaised)
                    );
                  }
                }
                if (field === "paymentStatus" || field === "paymentReceivedStatus") {
                  if (Array.isArray(value) && value.length > 0) {
                    const totalAmt = sale.total || sale.salesPriceWithGst || 0;
                    const docPayments = (state.payments || []).filter((p) => p.documentId === sale.id);
                    const paidFromPayments = docPayments.reduce((sum, p) => sum + p.amount, 0);
                    const paidAmt =
                      sale.receivedPayment !== undefined && sale.receivedPayment > 0
                        ? sale.receivedPayment
                        : paidFromPayments;
                    const isPaid =
                      (totalAmt > 0 && paidFromPayments >= totalAmt) ||
                      (totalAmt > 0 && (sale.receivedPayment || 0) >= totalAmt) ||
                      sale.paymentReceivedStatus === "Received" ||
                      sale.paymentReceivedStatus === "Payment Received";
                    const isPartPaid =
                      !isPaid &&
                      ((paidFromPayments > 0 && paidFromPayments < totalAmt) ||
                        ((sale.receivedPayment || 0) > 0 && (sale.receivedPayment || 0) < totalAmt) ||
                        sale.paymentReceivedStatus === "Part Paid" ||
                        paidAmt > 0);
                    const st = isPaid ? "Received" : isPartPaid ? "Part Paid" : "Not Received";
                    const normValues = value.map((v) => String(v).toLowerCase().trim());
                    return (
                      value.includes(st) ||
                      value.includes(sale.paymentReceivedStatus || "") ||
                      normValues.includes(st.toLowerCase()) ||
                      normValues.includes((sale.paymentReceivedStatus || "").toLowerCase()) ||
                      (normValues.includes("received") && isPaid) ||
                      (normValues.includes("paid") && isPaid) ||
                      (normValues.includes("part paid") && isPartPaid) ||
                      (normValues.includes("not received") && !isPaid && !isPartPaid) ||
                      (normValues.includes("unpaid") && !isPaid && !isPartPaid)
                    );
                  }
                }
                if (field === "date") {
                  if (Array.isArray(value) && value.length === 2 && value[0]) {
                    const d = (sale.date || "").slice(0, 10);
                    const from = value[0];
                    const to = value[1] || value[0];
                    if (from && d < from) return false;
                    if (to && d > to) return false;
                  }
                }
                if (field === "surgeryDate") {
                  if (Array.isArray(value) && value.length === 2 && value[0]) {
                    const d = (sale.surgeryDate || sale.date || "").slice(0, 10);
                    const from = value[0];
                    const to = value[1] || value[0];
                    if (from && d < from) return false;
                    if (to && d > to) return false;
                  }
                }
                if (field === "mrp") {
                  const { min, max } = value as { min: number | null; max: number | null };
                  const v = sale.mrp ?? 0;
                  if (min != null && v < min) return false;
                  if (max != null && v > max) return false;
                }
                if (field === "buyPrice") {
                  const { min, max } = value as { min: number | null; max: number | null };
                  const v = sale.buyPrice ?? 0;
                  if (min != null && v < min) return false;
                  if (max != null && v > max) return false;
                }
                if (field === "salesPrice") {
                  const { min, max } = value as { min: number | null; max: number | null };
                  const v = sale.salesPrice ?? sale.net;
                  if (min != null && v < min) return false;
                  if (max != null && v > max) return false;
                }
                if (field === "salesPriceWithGst") {
                  const { min, max } = value as { min: number | null; max: number | null };
                  const v = sale.salesPriceWithGst ?? sale.total;
                  if (min != null && v < min) return false;
                  if (max != null && v > max) return false;
                }
                return true;
              });
            }

            // Purchases filtering
            if (state.purchases && (!tabParam || tabParam === "Purchases" || tabParam === "Payments")) {
              state.purchases = state.purchases.filter((purchase) => {
                if (field === "vendor" || field === "name") {
                  const vName = state.vendors.find((v) => v.id === purchase.vendorId)?.name || "";
                  if (strVal) {
                    return vName.toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.includes(vName);
                  }
                }
                if (field === "handledBy") {
                  if (strVal) {
                    return (purchase.handledBy || "").toLowerCase().includes(strVal);
                  }
                }
                if (field === "items" || field === "item" || field === "productName" || field === "implant" || field === "batch") {
                  if (strVal) {
                    return purchase.lines?.some(
                      (l) =>
                        (l.productName || "").toLowerCase().includes(strVal) ||
                        (l.batch || "").toLowerCase().includes(strVal)
                    );
                  }
                }
                if (field === "document" || field === "reference") {
                  if (strVal) {
                    return `${purchase.reference || ""} ${purchase.id || ""}`.toLowerCase().includes(strVal);
                  }
                }
                if (field === "status") {
                  if (Array.isArray(value) && value.length > 0) {
                    const docPaid = (state.payments || [])
                      .filter((p) => p.documentId === purchase.id)
                      .reduce((acc, p) => acc + p.amount, 0);
                    const isPaid = purchase.total > 0 && docPaid >= purchase.total;
                    const isPartPaid = docPaid > 0 && docPaid < purchase.total;
                    const isUnpaid = docPaid === 0;
                    const paymentStatus =
                      purchase.status === "VOID"
                        ? "Void"
                        : isPaid
                          ? "Paid"
                          : isPartPaid
                            ? "Part paid"
                            : "Unpaid";
                    const normValues = value.map((v) => String(v).toLowerCase().trim());
                    return (
                      value.includes(purchase.status || "") ||
                      value.includes(paymentStatus) ||
                      normValues.includes(paymentStatus.toLowerCase()) ||
                      normValues.includes((purchase.status || "").toLowerCase()) ||
                      (normValues.includes("unpaid") && isUnpaid) ||
                      (normValues.includes("outstanding") && (isUnpaid || isPartPaid)) ||
                      (normValues.includes("part paid") && isPartPaid) ||
                      (normValues.includes("paid") && isPaid) ||
                      (normValues.includes("void") && (paymentStatus === "Void" || purchase.status === "VOID")) ||
                      (normValues.includes("posted") && purchase.status === "POSTED")
                    );
                  }
                }
                if (field === "date") {
                  if (Array.isArray(value) && value.length === 2 && value[0]) {
                    const d = (purchase.date || "").slice(0, 10);
                    const from = value[0];
                    const to = value[1] || value[0];
                    if (from && d < from) return false;
                    if (to && d > to) return false;
                  }
                }
                if (field === "total") {
                  const { min, max } = value as { min: number | null; max: number | null };
                  const v = purchase.total ?? 0;
                  if (min != null && v < min) return false;
                  if (max != null && v > max) return false;
                }
                return true;
              });
            }

            // Balances filtering
            if (state.balances && (!tabParam || tabParam === "Stock" || tabParam === "Overview")) {
              state.balances = state.balances.filter((balance) => {
                if (field === "item" || field === "items" || field === "productName" || field === "implant" || field === "name") {
                  const lot = state.lots.find((l) => l.id === balance.lotId);
                  const pName = state.products.find((p) => p.id === lot?.productId)?.name || "";
                  if (strVal) {
                    return pName.toLowerCase().includes(strVal) || (lot?.batch || "").toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.includes(pName);
                  }
                }
                if (field === "batch") {
                  const lot = state.lots.find((l) => l.id === balance.lotId);
                  if (strVal) {
                    return (lot?.batch || "").toLowerCase().includes(strVal);
                  }
                }
                if (field === "location") {
                  const lName = state.locations.find((l) => l.id === balance.locationId)?.name || "";
                  if (strVal) {
                    return lName.toLowerCase().includes(strVal);
                  }
                  if (Array.isArray(value) && value.length > 0) {
                    return value.includes(lName);
                  }
                }
                if (field === "quantity" || field === "onHand") {
                  const { min, max } = value as { min: number | null; max: number | null };
                  const v = balance.quantity ?? 0;
                  if (min != null && v < min) return false;
                  if (max != null && v > max) return false;
                }
                if (field === "status") {
                  if (Array.isArray(value) && value.length > 0) {
                    const today = new Date().toISOString().slice(0, 10);
                    const lot = state.lots.find((l) => l.id === balance.lotId);
                    const prod = state.products.find((p) => p.id === lot?.productId);
                    const isOutOfStock = balance.quantity === 0;
                    const st = balance.quarantined
                      ? "Quarantined"
                      : (lot?.expiry && lot.expiry < today)
                        ? "Expired"
                        : isOutOfStock
                          ? "Out of stock"
                          : (prod?.minimum && balance.quantity <= prod.minimum)
                            ? "Low stock"
                            : "Available";
                    return (
                      value.includes(st) ||
                      (value.includes("Empty") && isOutOfStock) ||
                      (value.includes("Out of stock") && isOutOfStock)
                    );
                  }
                }
                return true;
              });
            }

            // Transfers filtering
            if (state.transfers && (!tabParam || tabParam === "Transfers & kits")) {
              state.transfers = state.transfers.filter((transfer) => {
                if (field === "caseReference" || field === "caseType" || field === "reference") {
                  if (strVal) {
                    return (transfer.caseReference || transfer.kind || "").toLowerCase().includes(strVal);
                  }
                }
                if (field === "route" || field === "transfer" || field === "carrier") {
                  if (strVal) {
                    const fromName = state.locations.find((l) => l.id === transfer.fromId)?.name || "";
                    const toName = state.locations.find((l) => l.id === transfer.toId)?.name || "";
                    const routeStr = `${fromName} -> ${toName} ${transfer.kind || ""} ${transfer.notes || ""}`.toLowerCase();
                    return routeStr.includes(strVal);
                  }
                }
                if (field === "status") {
                  if (Array.isArray(value) && value.length > 0) {
                    const normValues = value.map((v) =>
                      String(v).toUpperCase().replaceAll(" ", "_")
                    );
                    const tStatus = (transfer.status || "").toUpperCase();
                    return value.includes(transfer.status || "") || normValues.includes(tStatus);
                  }
                }
                if (field === "date") {
                  if (Array.isArray(value) && value.length === 2 && value[0]) {
                    const d = (transfer.date || "").slice(0, 10);
                    const from = value[0];
                    const to = value[1] || value[0];
                    if (from && d < from) return false;
                    if (to && d > to) return false;
                  }
                }
                return true;
              });
            }

            // Deliveries filtering
            if (state.deliveries && tabParam === "Delivery expenses") {
              state.deliveries = state.deliveries.filter((del) => {
                if (field === "route" || field === "carrier") {
                  if (strVal) {
                    return `${del.carrier || ""} ${del.notes || ""} ${del.reason || ""}`.toLowerCase().includes(strVal);
                  }
                }
                if (field === "status") {
                  if (Array.isArray(value) && value.length > 0) {
                    const delStatus = del.voided ? "Voided" : "Recorded";
                    return value.includes(delStatus);
                  }
                }
                return true;
              });
            }

            // Payments filtering
            if (state.payments && (!tabParam || tabParam === "Payments")) {
              state.payments = state.payments.filter((p) => {
                if (field === "handledBy" || field === "bdmName") {
                  if (Array.isArray(value) && value.length > 0) return value.includes(p.handledBy);
                  if (strVal) return p.handledBy.toLowerCase().includes(strVal);
                }
                return true;
              });
            }

            // Master collections filtering (status, name)
            if (!tabParam || tabParam === "Vendors" || tabParam === "Implant catalog" || tabParam === "Locations") {
              if (field === "status" && Array.isArray(value) && value.length > 0) {
                const wantActive = value.includes("Active");
                const wantDeleted = value.includes("Deleted");
                if (state.vendors) state.vendors = state.vendors.filter((v) => (wantActive && !v.archived) || (wantDeleted && v.archived));
                if (state.products) state.products = state.products.filter((p) => (wantActive && !p.archived) || (wantDeleted && p.archived));
                if (state.locations) state.locations = state.locations.filter((l) => (wantActive && !l.archived) || (wantDeleted && l.archived));
              }
              if (strVal && (field === "name" || field === "item" || field === "vendor" || field === "location")) {
                if (state.vendors) state.vendors = state.vendors.filter((v) => v.name.toLowerCase().includes(strVal));
                if (state.products) state.products = state.products.filter((p) => p.name.toLowerCase().includes(strVal));
                if (state.locations) state.locations = state.locations.filter((l) => l.name.toLowerCase().includes(strVal));
              }
            }

            // Activity audit log filtering
            if (snapshot.audit && (!tabParam || tabParam === "Activity log" || tabParam === "Overview")) {
              snapshot.audit = snapshot.audit.filter((a) => {
                if (field === "action") {
                  if (Array.isArray(value) && value.length > 0) {
                    const targetSet = new Set(
                      value.flatMap((v) => {
                        const s = String(v).toLowerCase().trim();
                        return [
                          s,
                          s.replaceAll(".", " "),
                          s.replaceAll(" ", "."),
                          s.replaceAll("_", "."),
                          s.replaceAll("_", " "),
                        ];
                      })
                    );
                    const rawAction = (a.action || "").toLowerCase().trim();
                    const rawSpaced = rawAction.replaceAll(".", " ").replaceAll("_", " ");
                    return (
                      targetSet.has(rawAction) ||
                      targetSet.has(rawSpaced) ||
                      value.includes(a.action) ||
                      value.some((v) => {
                        const s = String(v).toLowerCase().trim();
                        return (
                          rawAction === s ||
                          rawAction.includes(s) ||
                          s.includes(rawAction) ||
                          rawSpaced.includes(s)
                        );
                      })
                    );
                  }
                  if (strVal) {
                    const rawAction = (a.action || "").toLowerCase();
                    const rawSpaced = rawAction.replaceAll(".", " ");
                    return rawAction.includes(strVal) || rawSpaced.includes(strVal);
                  }
                }
                if (field === "changedBy" || field === "handledBy" || field === "bdmName") {
                  if (Array.isArray(value) && value.length > 0) {
                    return value.some((v) => (a.actorName || "").toLowerCase().includes(String(v).toLowerCase()));
                  }
                  if (strVal) return (a.actorName || "").toLowerCase().includes(strVal);
                }
                return true;
              });
            }
          }
        }
      } catch (err) {
        console.error("[filters_parse_error]", err);
      }
    }

    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") },
        { status: 400 },
      );
    }
    return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    if (!actor.permissions.includes("write")) {
      throw new InventoryError("You do not have permission to modify inventory.", 403);
    }
    const text = await request.text();
    if (text.length > 1_000_000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    return Response.json(
      await postCommand(actor, JSON.parse(text)),
    );
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") },
        { status: 400 },
      );
    }
    return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
