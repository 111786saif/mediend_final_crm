import { NextRequest } from "next/server";
import { getSessionFromRequest, getSessionWithFreshUser } from "@/lib/session";
import { getSnapshot } from "@/lib/inventory/repository";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toOptions(
  values: Array<string | null | undefined>
): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ label: name, value: name }));
}

export async function GET(request: NextRequest) {
  try {
    let session = getSessionFromRequest(request);
    if (!session) {
      try {
        session = await getSessionWithFreshUser();
      } catch {
        // cookies() outside request store in some contexts
      }
    }
    if (!session) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const actor = {
      id: session.id,
      name: session.name || session.email || "Staff User",
      workspaceId: "default",
      permissions: ["read"] as Array<"read" | "write" | "admin">,
    };

    const [
      { state, audit },
      bdUsers,
      managerUsers,
      leadRefs,
      hospitalMasters,
      plHospitals,
      dsHospitals,
      leadHospitals,
      doctorMasters,
      plDoctors,
      dsDoctors,
      plManagers,
      dsManagers,
      plCategories,
      dsCategories,
      leadCategories,
      plCircles,
      dsCircles,
      leadCircles,
      plPaymentTypes,
      dsPaymentTypes,
      plStatuses,
      dsStatuses,
      leadCaseStages,
      plTreatments,
      dsTreatments,
      leadTreatments,
      treatmentMasters,
    ] = await Promise.all([
      getSnapshot(actor),
      prisma.user.findMany({
        where: { role: UserRole.BD },
        select: { name: true },
        orderBy: { name: "asc" },
      }).catch(() => []),
      prisma.user.findMany({
        where: {
          role: {
            in: [
              UserRole.TEAM_LEAD,
              UserRole.CATEGORY_MANAGER,
              UserRole.ASSISTANT_CATEGORY_MANAGER,
              UserRole.SALES_HEAD,
            ],
          },
        },
        select: { name: true },
        orderBy: { name: "asc" },
      }).catch(() => []),
      prisma.lead.findMany({
        select: { leadRef: true },
        distinct: ["leadRef"],
        orderBy: { leadRef: "asc" },
      }).catch(() => []),
      prisma.hospitalMaster.findMany({ select: { name: true }, orderBy: { name: "asc" } }).catch(() => []),
      prisma.pLRecord.findMany({ where: { hospitalName: { not: null } }, select: { hospitalName: true }, distinct: ["hospitalName"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { hospitalName: { not: null } }, select: { hospitalName: true }, distinct: ["hospitalName"] }).catch(() => []),
      prisma.lead.findMany({ where: { hospitalName: { not: "" } }, select: { hospitalName: true }, distinct: ["hospitalName"] }).catch(() => []),
      prisma.doctorMaster.findMany({ select: { name: true }, orderBy: { name: "asc" } }).catch(() => []),
      prisma.pLRecord.findMany({ where: { doctorName: { not: null } }, select: { doctorName: true }, distinct: ["doctorName"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { doctorName: { not: null } }, select: { doctorName: true }, distinct: ["doctorName"] }).catch(() => []),
      prisma.pLRecord.findMany({ where: { managerName: { not: null } }, select: { managerName: true }, distinct: ["managerName"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { managerName: { not: null } }, select: { managerName: true }, distinct: ["managerName"] }).catch(() => []),
      prisma.pLRecord.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] }).catch(() => []),
      prisma.lead.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] }).catch(() => []),
      prisma.pLRecord.findMany({ where: { circle: { not: null } }, select: { circle: true }, distinct: ["circle"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { circle: { not: null } }, select: { circle: true }, distinct: ["circle"] }).catch(() => []),
      prisma.lead.findMany({ where: { circle: { not: "" } }, select: { circle: true }, distinct: ["circle"] }).catch(() => []),
      prisma.pLRecord.findMany({ where: { paymentType: { not: null } }, select: { paymentType: true }, distinct: ["paymentType"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { paymentType: { not: null } }, select: { paymentType: true }, distinct: ["paymentType"] }).catch(() => []),
      prisma.pLRecord.findMany({ where: { status: { not: null } }, select: { status: true }, distinct: ["status"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { status: { not: null } }, select: { status: true }, distinct: ["status"] }).catch(() => []),
      prisma.lead.findMany({ select: { caseStage: true }, distinct: ["caseStage"] }).catch(() => []),
      prisma.pLRecord.findMany({ where: { treatment: { not: null } }, select: { treatment: true }, distinct: ["treatment"] }).catch(() => []),
      prisma.dischargeSheet.findMany({ where: { treatment: { not: null } }, select: { treatment: true }, distinct: ["treatment"] }).catch(() => []),
      prisma.lead.findMany({ where: { treatment: { not: "" } }, select: { treatment: true }, distinct: ["treatment"] }).catch(() => []),
      prisma.treatmentMaster.findMany({ select: { name: true }, orderBy: { name: "asc" } }).catch(() => []),
    ]);

    // Aggregate options from authoritative DB models + Inventory state
    const hospitalOptions = toOptions([
      ...plHospitals.map((h) => h.hospitalName),
      ...dsHospitals.map((h) => h.hospitalName),
      ...leadHospitals.map((h) => h.hospitalName),
      ...hospitalMasters.map((h) => h.name),
      ...state.sales.map((s) => s.hospitalName),
      ...state.locations.map((l) => l.name),
    ]);

    const bdeOptions =
      bdUsers.length > 0
        ? toOptions(bdUsers.map((u) => u.name))
        : toOptions([
            ...state.sales.map((s) => s.bdmName),
            ...state.sales.map((s) => s.handledBy),
          ]);
    const bdmOptions = bdeOptions;

    const managerOptions =
      managerUsers.length > 0
        ? toOptions(managerUsers.map((m) => m.name))
        : toOptions([
            ...plManagers.map((m) => m.managerName),
            ...dsManagers.map((m) => m.managerName),
            ...state.sales.map((s) => s.managerName),
          ]);

    const doctorOptions =
      doctorMasters.length > 0
        ? toOptions(doctorMasters.map((d) => d.name))
        : toOptions([
            ...plDoctors.map((d) => d.doctorName),
            ...dsDoctors.map((d) => d.doctorName),
            ...state.sales.map((s) => s.drName),
          ]);

    const treatmentOptions =
      treatmentMasters.length > 0
        ? toOptions(treatmentMasters.map((t) => t.name))
        : toOptions([
            ...plTreatments.map((t) => t.treatment),
            ...dsTreatments.map((t) => t.treatment),
            ...leadTreatments.map((t) => t.treatment),
            ...state.sales.map((s) => s.treatment),
          ]);

    const knownCircles = ["Bangalore", "Delhi", "Hyderabad", "Mumbai", "Pune"];
    const dbCircles = [
      ...plCircles.map((c) => c.circle),
      ...dsCircles.map((c) => c.circle),
      ...leadCircles.map((c) => c.circle),
      ...state.sales.map((s) => s.circle),
    ];
    const circleOptions = toOptions([...knownCircles, ...dbCircles]).filter((o) => o.value !== "Unknown");

    const knownPaymentTypes = [
      "Cash",
      "Cashless",
      "CASH",
      "INSURANCE",
      "TPA",
      "Cheque",
      "Online",
      "UPI",
      "Card",
      "NEFT/RTGS",
      "Bank Transfer",
    ];
    const dbPaymentTypes = [
      ...plPaymentTypes.map((p) => p.paymentType),
      ...dsPaymentTypes.map((p) => p.paymentType),
      ...state.sales.map((s) => s.mop),
      ...state.payments.map((p) => p.method),
    ];
    const mopOptions = toOptions([...knownPaymentTypes, ...dbPaymentTypes]);

    // Statuses — contextual and domain-specific
    const stockStatusOptions = toOptions([
      "Available",
      "Low stock",
      "Empty",
      "Out of stock",
      "Expired",
      "Quarantined",
    ]);

    const purchaseStatusOptions = toOptions([
      "Paid",
      "Part paid",
      "Unpaid",
      "POSTED",
      "VOID",
    ]);

    const transferStatusOptions = [
      { label: "IN_TRANSIT", value: "IN_TRANSIT" },
      { label: "RECEIVED", value: "RECEIVED" },
      { label: "CANCELLED", value: "CANCELLED" },
    ];

    const deliveryStatusOptions = toOptions(["Recorded", "Voided"]);

    const masterStatusOptions = toOptions(["Active", "Deleted"]);

    const paymentStatusOptions = toOptions([
      "Received",
      "Part Paid",
      "Not Received",
      "Payment Received",
      "Outstanding",
      "Paid",
      "Unpaid",
      "Pending",
      "POSTED",
      "VOID",
      ...state.sales.map((s) => s.paymentReceivedStatus),
    ]);

    const knownActions = [
      { label: "Sale Post", value: "sale.post" },
      { label: "Purchase Post", value: "purchase.post" },
      { label: "Document Void", value: "document.void" },
      { label: "Transfer Dispatch", value: "transfer.dispatch" },
      { label: "Transfer Receive", value: "transfer.receive" },
      { label: "Transfer Cancel", value: "transfer.cancel" },
      { label: "Payment Post", value: "payment.post" },
      { label: "Delivery Save", value: "delivery.save" },
      { label: "Delivery Void", value: "delivery.void" },
      { label: "Stock Adjust", value: "stock.adjust" },
      { label: "Stock Quarantine", value: "stock.quarantine" },
      { label: "Vendor Save", value: "vendor.save" },
      { label: "Product Save", value: "product.save" },
      { label: "Location Save", value: "location.save" },
      { label: "Master Archive", value: "master.archive" },
      { label: "Attachment Upload", value: "attachment.upload" },
    ];
    const auditActions: string[] = ((audit || []) as Array<{ action?: string }>)
      .map((a) => a.action)
      .filter((act): act is string => Boolean(act));
    const actionSet = new Set([...knownActions.map((k) => k.value), ...auditActions]);
    const activityActionOptions = Array.from(actionSet)
      .map((act) => {
        const found = knownActions.find((k) => k.value === act);
        const label = found
          ? found.label
          : act.replaceAll(".", " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return { label, value: act.toLowerCase() };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    // General status fallback (inventory domain only, no lead stages)
    const knownStatuses = [
      "Available",
      "Low stock",
      "Empty",
      "Out of stock",
      "Quarantined",
      "Expired",
      "POSTED",
      "VOID",
      "Paid",
      "Part paid",
      "Unpaid",
      "Recorded",
      "Voided",
      "Active",
      "Deleted",
      "IN_TRANSIT",
      "RECEIVED",
      "CANCELLED",
    ];
    const statusOptions = toOptions(knownStatuses);

    // Invoice Statuses
    const knownInvoiceStatuses = [
      "Raised",
      "Pending",
      "Invoice Raised",
      "Not Raised",
      "Need Invoice",
      "CANCELLED",
    ];
    const dbInvoiceStatuses = [
      ...state.sales.map((s) => s.invoiceStatus),
    ];
    const invoiceStatusOptions = toOptions([...knownInvoiceStatuses, ...dbInvoiceStatuses]);

    const vendorOptions = toOptions([
      ...state.vendors.map((v) => v.name),
      ...state.purchases.map((p) => state.vendors.find((v) => v.id === p.vendorId)?.name),
    ]);

    const productOptions = toOptions([
      ...state.products.map((p) => p.name),
      ...state.lots.map((l) => state.products.find((p) => p.id === l.productId)?.name),
      ...state.sales.flatMap((s) => s.lines?.map((l) => l.productName)),
      ...state.purchases.flatMap((p) => p.lines?.map((l) => l.productName)),
    ]);

    const locationOptions = toOptions([
      ...hospitalMasters.map((h) => h.name),
      ...state.locations.map((l) => l.name),
      ...state.sales.map((s) => s.hospitalName),
    ]);
    const sizeOptions = toOptions(state.lots.map((l) => l.size));
    const categoryOptions = toOptions([
      ...plCategories.map((c) => c.category),
      ...dsCategories.map((c) => c.category),
      ...leadCategories.map((c) => c.category),
    ]);
    const leadRefOptions = toOptions([
      ...leadRefs.map((r) => (r.leadRef != null ? String(r.leadRef) : null)),
      ...state.sales.map((s) => s.caseReference),
      ...state.transfers.map((t) => t.caseReference),
    ]);

    // Numeric bounds
    const mrpValues = state.sales
      .map((s) => s.mrp ?? 0)
      .concat(state.products.map((p) => p.mrp ?? 0))
      .filter((n) => n > 0);
    const minMrp = mrpValues.length > 0 ? Math.min(...mrpValues) : 0;
    const maxMrp = mrpValues.length > 0 ? Math.max(...mrpValues) : 100000;

    const buyPriceValues = state.sales
      .map((s) => s.buyPrice ?? 0)
      .concat(state.purchases.map((p) => p.net ?? 0))
      .filter((n) => n > 0);
    const minBuyPrice = buyPriceValues.length > 0 ? Math.min(...buyPriceValues) : 0;
    const maxBuyPrice = buyPriceValues.length > 0 ? Math.max(...buyPriceValues) : 100000;

    const salesPriceValues = state.sales
      .map((s) => s.salesPrice ?? s.net ?? 0)
      .filter((n) => n > 0);
    const minSalesPrice = salesPriceValues.length > 0 ? Math.min(...salesPriceValues) : 0;
    const maxSalesPrice = salesPriceValues.length > 0 ? Math.max(...salesPriceValues) : 100000;

    const totalWithGstValues = state.sales
      .map((s) => s.salesPriceWithGst ?? s.total ?? 0)
      .filter((n) => n > 0);
    const minTotalWithGst = totalWithGstValues.length > 0 ? Math.min(...totalWithGstValues) : 0;
    const maxTotalWithGst = totalWithGstValues.length > 0 ? Math.max(...totalWithGstValues) : 100000;

    const purchaseTotalValues = state.purchases
      .map((p) => p.total ?? 0)
      .filter((n) => n > 0);
    const minPurchaseTotal = purchaseTotalValues.length > 0 ? Math.min(...purchaseTotalValues) : 0;
    const maxPurchaseTotal = purchaseTotalValues.length > 0 ? Math.max(...purchaseTotalValues) : 100000;

    const stockQtyValues = state.balances.map((b) => b.quantity ?? 0).filter((n) => n > 0);
    const minStockQty = stockQtyValues.length > 0 ? Math.min(...stockQtyValues) : 0;
    const maxStockQty = stockQtyValues.length > 0 ? Math.max(...stockQtyValues) : 1000;

    return Response.json(
      {
        filters: [
          // Common / Date
          { field: "date", label: "Date", filterType: "dateRange", filterable: true },
          { field: "surgeryDate", label: "Surgery Date", filterType: "dateRange", filterable: true },
          { field: "expiry", label: "Expiry", filterType: "dateRange", filterable: true },

          // Master list dropdowns (Vendor, Location, Implant / Item)
          { field: "vendor", label: "Vendor", filterType: "multiSelect", filterable: true, options: vendorOptions },
          { field: "location", label: "Location", filterType: "multiSelect", filterable: true, options: locationOptions },
          { field: "hospitalName", label: "Hospital Name", filterType: "multiSelect", filterable: true, options: locationOptions },
          { field: "hospital", label: "Hospital", filterType: "multiSelect", filterable: true, options: locationOptions },
          { field: "item", label: "Item", filterType: "multiSelect", filterable: true, options: productOptions },
          { field: "items", label: "Items", filterType: "multiSelect", filterable: true, options: productOptions },
          { field: "productName", label: "Product Name", filterType: "multiSelect", filterable: true, options: productOptions },
          { field: "implant", label: "Implant", filterType: "multiSelect", filterable: true, options: productOptions },

          // Sales product & activity dropdowns requested by user
          { field: "bdmName", label: "BDM Name", filterType: "multiSelect", filterable: true, options: bdmOptions },
          { field: "bdm", label: "BDM", filterType: "multiSelect", filterable: true, options: bdmOptions },
          { field: "drName", label: "Dr. Name", filterType: "multiSelect", filterable: true, options: doctorOptions },
          { field: "doctor", label: "Doctor", filterType: "multiSelect", filterable: true, options: doctorOptions },
          { field: "managerName", label: "Manager Name", filterType: "multiSelect", filterable: true, options: managerOptions },
          { field: "manager", label: "Manager", filterType: "multiSelect", filterable: true, options: managerOptions },
          { field: "treatment", label: "Treatment", filterType: "multiSelect", filterable: true, options: treatmentOptions },
          { field: "handledBy", label: "Handled by", filterType: "multiSelect", filterable: true, options: bdmOptions },
          { field: "changedBy", label: "Changed by", filterType: "multiSelect", filterable: true, options: bdmOptions },
          { field: "action", label: "Action", filterType: "multiSelect", filterable: true, options: activityActionOptions },

          // Contextual status filters
          { field: "stockStatus", label: "Stock Status", filterType: "multiSelect", filterable: true, options: stockStatusOptions },
          { field: "purchaseStatus", label: "Purchase Status", filterType: "multiSelect", filterable: true, options: purchaseStatusOptions },
          { field: "transferStatus", label: "Transfer Status", filterType: "multiSelect", filterable: true, options: transferStatusOptions },
          { field: "deliveryStatus", label: "Delivery Status", filterType: "multiSelect", filterable: true, options: deliveryStatusOptions },
          { field: "masterStatus", label: "Master Status", filterType: "multiSelect", filterable: true, options: masterStatusOptions },

          // Search Filters (Names, text, and identifiers)
          { field: "name", label: "Name", filterType: "search", filterable: true },
          { field: "patientName", label: "Patient Name", filterType: "search", filterable: true },
          { field: "billedTo", label: "Billed to", filterType: "search", filterable: true },
          { field: "leadRef", label: "Lead Ref", filterType: "search", filterable: true },
          { field: "caseReference", label: "Case Reference No.", filterType: "search", filterable: true },
          { field: "caseRefNo", label: "Case Reference No.", filterType: "search", filterable: true },
          { field: "document", label: "Document", filterType: "search", filterable: true },
          { field: "reference", label: "Reference", filterType: "search", filterable: true },
          { field: "batch", label: "Batch", filterType: "search", filterable: true },
          { field: "remark", label: "Remark", filterType: "search", filterable: true },
          { field: "notes", label: "Notes", filterType: "search", filterable: true },
          { field: "reason", label: "Reason", filterType: "search", filterable: true },
          { field: "details", label: "Details", filterType: "search", filterable: true },
          { field: "transfer", label: "Transfer", filterType: "search", filterable: true },
          { field: "route", label: "Route", filterType: "search", filterable: true },
          { field: "carrier", label: "Carrier", filterType: "search", filterable: true },

          // Categorical Multi-Select Options from DB
          { field: "category", label: "Category", filterType: "multiSelect", filterable: true, options: categoryOptions },
          { field: "circle", label: "Circle", filterType: "multiSelect", filterable: true, options: circleOptions },
          { field: "mop", label: "MOP", filterType: "multiSelect", filterable: true, options: mopOptions },
          { field: "paymentType", label: "Payment Type", filterType: "multiSelect", filterable: true, options: mopOptions },
          {
            field: "direction",
            label: "Direction",
            filterType: "multiSelect",
            filterable: true,
            options: [
              { label: "Collected", value: "Collected" },
              { label: "Paid", value: "Paid" },
            ],
          },
          { field: "status", label: "Status", filterType: "multiSelect", filterable: true, options: statusOptions },
          { field: "invoiceStatus", label: "Invoice Status", filterType: "multiSelect", filterable: true, options: invoiceStatusOptions },
          { field: "paymentStatus", label: "Payment Status", filterType: "multiSelect", filterable: true, options: paymentStatusOptions },
          { field: "paymentReceivedStatus", label: "Payment Received Status", filterType: "multiSelect", filterable: true, options: paymentStatusOptions },
          { field: "size", label: "Size", filterType: "multiSelect", filterable: true, options: sizeOptions },
          {
            field: "gstType",
            label: "GST Type",
            filterType: "multiSelect",
            filterable: true,
            options: [
              { label: "WITH_GST", value: "WITH_GST" },
              { label: "WITHOUT_GST", value: "WITHOUT_GST" },
            ],
          },

          // Number Range Bounds from DB
          { field: "mrp", label: "MRP", filterType: "numberRange", filterable: true, min: minMrp, max: maxMrp },
          { field: "buyPrice", label: "Buy Price", filterType: "numberRange", filterable: true, min: minBuyPrice, max: maxBuyPrice },
          { field: "salesPrice", label: "Sales Price", filterType: "numberRange", filterable: true, min: minSalesPrice, max: maxSalesPrice },
          { field: "salesPriceWithGst", label: "Sales Price with GST", filterType: "numberRange", filterable: true, min: minTotalWithGst, max: maxTotalWithGst },
          { field: "total", label: "Total", filterType: "numberRange", filterable: true, min: minPurchaseTotal, max: maxPurchaseTotal },
          { field: "quantity", label: "Quantity", filterType: "numberRange", filterable: true, min: minStockQty, max: maxStockQty },
          { field: "onHand", label: "On hand", filterType: "numberRange", filterable: true, min: minStockQty, max: maxStockQty },
          { field: "unitCost", label: "Unit cost", filterType: "numberRange", filterable: true, min: 0, max: 50000 },
          { field: "unitPrice", label: "Unit price", filterType: "numberRange", filterable: true, min: 0, max: 50000 },
          { field: "paid", label: "Paid", filterType: "numberRange", filterable: true, min: 0, max: maxTotalWithGst },
          { field: "outstanding", label: "Outstanding", filterType: "numberRange", filterable: true, min: 0, max: maxTotalWithGst },
        ],
        tableStatuses: {
          Stock: stockStatusOptions,
          Overview: stockStatusOptions,
          Purchases: purchaseStatusOptions,
          "Transfers & kits": transferStatusOptions,
          "Delivery expenses": deliveryStatusOptions,
          Vendors: masterStatusOptions,
          "Implant catalog": masterStatusOptions,
          Locations: masterStatusOptions,
          Payments: paymentStatusOptions,
          Sales: paymentStatusOptions,
          "Sales Product": paymentStatusOptions,
          "Sales Finance": paymentStatusOptions,
          "Activity log": activityActionOptions,
        },
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (error) {
    console.error("[API_ERROR] GET /api/inventory/filter-config:", error);
    return Response.json({ error: "Failed to fetch filter config" }, { status: 500 });
  }
}
