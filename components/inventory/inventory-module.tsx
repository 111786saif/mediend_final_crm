"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnFilter } from "@/components/ui/column-filter";
import { Button } from "@/components/ui/button";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Box,
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  IndianRupee,
  Info,
  LayoutDashboard,
  MapPin,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import type {
  Audit,
  InventoryState,
  Snapshot,
  Purchase,
  Sale,
  MasterKind,
} from "@/lib/inventory/types";
import type { Command } from "@/lib/inventory/commands";
import { dashboard, profitReport, deliveryReport } from "@/lib/inventory/reports";
import { formatMoney as money, moneyInput } from "@/lib/inventory/money";
import { paid, todayIndia } from "@/lib/inventory/engine";
import { EntryForm } from "./entry-form";
import type { FormRequest } from "./forms";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const tabs = [
  ["Overview", LayoutDashboard],
  ["Stock", Box],
  ["Purchases", ShoppingCart],
  ["Transfers & kits", ArrowLeftRight],
  ["Sales", ClipboardList],
  ["Payments", Wallet],
  ["Implant P&L", IndianRupee],
  ["Delivery expenses", Truck],
  ["Vendors", Users],
  ["Implant catalog", Box],
  ["Locations", MapPin],
  ["Activity log", Activity],
] as const;

type Tab = (typeof tabs)[number][0];

const TAB_RESOURCE_KEYS: Record<Tab, string> = {
  Overview: "inventory.overview",
  Stock: "inventory.stock",
  Purchases: "inventory.purchases",
  "Transfers & kits": "inventory.transfers",
  Sales: "inventory.sales",
  Payments: "inventory.payments",
  "Implant P&L": "inventory.implant_pnl",
  "Delivery expenses": "inventory.delivery_expenses",
  Vendors: "inventory.vendors",
  "Implant catalog": "inventory.catalog",
  Locations: "inventory.locations",
  "Activity log": "inventory.activity",
};

const short = (id: string) => id.slice(0, 8).toUpperCase();

function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "blue";
}) {
  const toneClasses = {
    green: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
    red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50",
    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50",
  };
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-0.5 border ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

interface FilterConfigItem {
  field: string;
  label: string;
  filterType: "multiSelect" | "search" | "dateRange" | "numberRange" | "boolean";
  filterable: boolean;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
}

const InventoryFilterContext = createContext<{
  filterConfig: FilterConfigItem[];
  tableStatusConfig: Record<string, Array<{ label: string; value: string }>>;
  activeFilters: Record<string, any>;
  setFilter: (field: string, value: any) => void;
  resetFilters?: () => void;
}>({
  filterConfig: [],
  tableStatusConfig: {},
  activeFilters: {},
  setFilter: () => {},
  resetFilters: () => {},
});

function Table({
  heads,
  rows,
  empty = "No records found.",
  tabKey,
  enablePagination = true,
  initialPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
}: {
  heads: string[];
  rows: ReactNode[][];
  empty?: string;
  tabKey?: Tab | string;
  enablePagination?: boolean;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}) {
  const { hasAccess, permissions } = usePermissions();
  const { filterConfig, tableStatusConfig, activeFilters, setFilter } = useContext(InventoryFilterContext);

  const getColKey = (head: string) => {
    const map: Record<string, string> = {
      // Stock
      Item: "item",
      "Implant / batch": "item",
      "Item / Product": "item",
      Implant: "item",
      Size: "size",
      Location: "location",
      "On hand": "quantity",
      Quantity: "quantity",
      Units: "quantity",
      Sold: "quantity",
      "Unit cost": "unitCost",
      "Avg cost / unit": "unitCost",
      "Avg sale / unit": "salesPrice",
      Sales: "salesPrice",
      Cost: "buyPrice",
      "Profit / loss": "profit",
      Margin: "margin",
      Expiry: "expiry",
      Status: "status",

      // Purchases & Sales shared/specific
      Document: "document",
      Vendor: "vendor",
      "Vendor Name": "vendor",
      "Vendor / billed to": "vendor",
      "Billed to": "billedTo",
      "Case ref no.": "caseReference",
      "Case Reference No.": "caseReference",
      "Case / IPD Ref": "caseReference",
      "Case Ref": "caseReference",
      "Items & Location": "items",
      "Implant, Batch & Qty": "items",
      "Unit price": "unitPrice",
      "GST / type": "gstType",
      Total: "total",
      Paid: "paid",
      Outstanding: "outstanding",
      "Handled by": "handledBy",
      Actions: "actions",

      // Sales Product
      Date: "date",
      "BDM Name": "bdmName",
      BDM: "bdmName",
      "Manager Name": "managerName",
      Manager: "managerName",
      "Patient Name": "patientName",
      Treatment: "treatment",
      Circle: "circle",
      "Dr. Name": "drName",
      Doctor: "drName",
      "Doctor Name": "drName",
      "Hospital Name": "hospitalName",
      Hospital: "hospitalName",
      "Surgery Date": "surgeryDate",
      MOP: "mop",
      "Size Used": "sizeUsed",
      Remark: "remark",
      "Stock Used Form": "stockUsedForm",

      // Sales Finance
      "Invoice Raised/Need": "invoiceStatus",
      "Invoice Status": "invoiceStatus",
      MRP: "mrp",
      "Buy Price": "buyPrice",
      "Sales Price": "salesPrice",
      "GST %": "gstPercent",
      "GST Amount": "gstAmount",
      "Sales Price with GST": "salesPriceWithGst",
      "Payment Received/Not": "paymentStatus",
      "Payment Status": "paymentStatus",

      // Transfers
      Transfer: "transfer",
      Route: "route",
      Implants: "items",
      "Case / type": "caseReference",
      "Courier & fee": "carrier",

      // Deliveries
      "Date / transfer": "date",
      Carrier: "carrier",
      Fee: "total",

      // Payments
      Direction: "direction",
      Amount: "total",
      Method: "mop",
      Reference: "reference",
      Proof: "proof",

      // Masters
      Name: "name",
      Details: "details",

      // Activity log
      "When (IST)": "date",
      Action: "action",
      Record: "reference",
      "Changed by": "changedBy",
      Reason: "remark",
    };
    return map[head] || head.toLowerCase().replace(/[^a-z0-9]/g, "");
  };

  const rbacColumnVisibility = useMemo(() => {
    if (!tabKey) return undefined;
    const tabResKey = tabKey ? (TAB_RESOURCE_KEYS as Record<string, string>)[tabKey] : undefined;
    if (!tabResKey) return undefined;

    const vis: Record<string, boolean> = {};
    heads.forEach((head, idx) => {
      const colKey = getColKey(head);
      const resKey = `${tabResKey}.column.${colKey}`;
      const hasPermConfigured = permissions && Object.prototype.hasOwnProperty.call(permissions, resKey);
      if (hasPermConfigured) {
        vis[`col_${idx}`] = hasAccess(resKey, "READ");
      } else {
        vis[`col_${idx}`] = true;
      }
    });
    return vis;
  }, [heads, tabKey, hasAccess, permissions]);

  // Convert legacy heads + array rows into TanStack ColumnDef schema with backend-configured ColumnFilter
  const columns = useMemo<ColumnDef<ReactNode[]>[]>(() => {
    return heads.map((head, idx) => {
      const colKey = getColKey(head);
      const lowerHead = head.toLowerCase().trim();
      const isAction =
        colKey === "actions" ||
        lowerHead === "actions" ||
        (lowerHead === "action" && tabKey !== "Activity log");

      // Match column filter config from backend API (/api/inventory/filter-config)
      const cfg = filterConfig.find(
        (f) =>
          f.field === colKey ||
          f.field.toLowerCase() === colKey.toLowerCase() ||
          f.label.toLowerCase() === head.toLowerCase()
      );

      const isDateCol =
        lowerHead.includes("date") ||
        lowerHead.includes("expiry") ||
        lowerHead.includes("when") ||
        colKey === "date" ||
        colKey === "surgeryDate" ||
        colKey === "expiry";

      const isNumberCol =
        lowerHead.includes("price") ||
        lowerHead.includes("amount") ||
        lowerHead.includes("mrp") ||
        lowerHead.includes("cost") ||
        lowerHead.includes("total") ||
        lowerHead.includes("paid") ||
        lowerHead.includes("outstanding") ||
        lowerHead.includes("qty") ||
        lowerHead.includes("quantity") ||
        lowerHead.includes("units") ||
        lowerHead.includes("sold") ||
        lowerHead.includes("margin") ||
        lowerHead.includes("profit") ||
        lowerHead.includes("loss") ||
        lowerHead.includes("fee") ||
        colKey === "mrp" ||
        colKey === "buyPrice" ||
        colKey === "salesPrice" ||
        colKey === "salesPriceWithGst" ||
        colKey === "quantity" ||
        colKey === "total" ||
        colKey === "paid" ||
        colKey === "outstanding";

      const isMasterDropdown =
        colKey === "vendor" ||
        colKey === "location" ||
        colKey === "hospitalName" ||
        colKey === "hospital" ||
        colKey === "item" ||
        colKey === "items" ||
        colKey === "productName" ||
        colKey === "implant" ||
        colKey === "bdmName" ||
        colKey === "managerName" ||
        colKey === "drName" ||
        colKey === "treatment" ||
        colKey === "handledBy" ||
        colKey === "changedBy" ||
        colKey === "action" ||
        lowerHead === "bdm name" ||
        lowerHead === "bdm" ||
        lowerHead === "manager name" ||
        lowerHead === "manager" ||
        lowerHead === "dr. name" ||
        lowerHead === "doctor" ||
        lowerHead === "doctor name" ||
        lowerHead === "treatment" ||
        lowerHead === "handled by" ||
        lowerHead === "changed by" ||
        lowerHead === "action" ||
        lowerHead === "vendor" ||
        lowerHead === "vendor name" ||
        lowerHead === "location" ||
        lowerHead === "hospital" ||
        lowerHead === "hospital name" ||
        lowerHead === "item" ||
        lowerHead === "items" ||
        lowerHead === "implant" ||
        lowerHead === "implant / batch" ||
        lowerHead === "item / product" ||
        lowerHead === "implants" ||
        lowerHead === "implant, batch & qty" ||
        lowerHead === "items & location";

      const isDiscreteCategory =
        isMasterDropdown ||
        colKey === "circle" ||
        colKey === "status" ||
        colKey === "invoiceStatus" ||
        colKey === "paymentStatus" ||
        colKey === "paymentReceivedStatus" ||
        colKey === "gstType" ||
        colKey === "direction" ||
        colKey === "size" ||
        colKey === "mop" ||
        colKey === "paymentType" ||
        colKey === "action" ||
        lowerHead === "status" ||
        lowerHead === "circle" ||
        lowerHead === "gst / type" ||
        lowerHead === "invoice status" ||
        lowerHead === "payment status" ||
        lowerHead === "direction" ||
        lowerHead === "size" ||
        lowerHead === "mop" ||
        lowerHead === "action";

      let filterType: "search" | "multiSelect" | "dateRange" | "numberRange" | "boolean" = "search";
      if (cfg?.filterType) {
        filterType = cfg.filterType as any;
      } else if (isDiscreteCategory) {
        filterType = "multiSelect";
      } else if (isDateCol) {
        filterType = "dateRange";
      } else if (isNumberCol) {
        filterType = "numberRange";
      } else {
        filterType = "search";
      }

      let filterOptions = cfg?.options ?? [];

      // Contextual status filter options based on table domain
      if (lowerHead === "status" || colKey === "status") {
        if (tableStatusConfig && tabKey && tableStatusConfig[tabKey]?.length) {
          filterOptions = tableStatusConfig[tabKey];
        } else if (tabKey === "Stock" || tabKey === "Overview") {
          filterOptions = [
            { label: "Available", value: "Available" },
            { label: "Low stock", value: "Low stock" },
            { label: "Empty", value: "Empty" },
            { label: "Out of stock", value: "Out of stock" },
            { label: "Expired", value: "Expired" },
            { label: "Quarantined", value: "Quarantined" },
          ];
        } else if (tabKey === "Purchases") {
          filterOptions = [
            { label: "Paid", value: "Paid" },
            { label: "Part paid", value: "Part paid" },
            { label: "Unpaid", value: "Unpaid" },
            { label: "POSTED", value: "POSTED" },
            { label: "VOID", value: "VOID" },
          ];
        } else if (tabKey === "Transfers & kits") {
          filterOptions = [
            { label: "IN_TRANSIT", value: "IN_TRANSIT" },
            { label: "RECEIVED", value: "RECEIVED" },
            { label: "CANCELLED", value: "CANCELLED" },
          ];
        } else if (tabKey === "Delivery expenses") {
          filterOptions = [
            { label: "Recorded", value: "Recorded" },
            { label: "Voided", value: "Voided" },
          ];
        } else if (
          tabKey === "Vendors" ||
          tabKey === "Implant catalog" ||
          tabKey === "Locations"
        ) {
          filterOptions = [
            { label: "Active", value: "Active" },
            { label: "Deleted", value: "Deleted" },
          ];
        } else if (tabKey === "Payments" || tabKey === "Sales" || tabKey === "Sales Product" || tabKey === "Sales Finance") {
          filterOptions = [
            { label: "Outstanding", value: "Outstanding" },
            { label: "Paid", value: "Paid" },
            { label: "Part Paid", value: "Part Paid" },
            { label: "Unpaid", value: "Unpaid" },
            { label: "POSTED", value: "POSTED" },
            { label: "VOID", value: "VOID" },
          ];
        }
      } else if (lowerHead === "action" || colKey === "action") {
        filterType = "multiSelect";
        filterOptions =
          tableStatusConfig?.["Activity log"]?.length
            ? tableStatusConfig["Activity log"]
            : cfg?.options?.length
            ? cfg.options
            : [
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
      } else if (lowerHead === "invoice status" || colKey === "invoiceStatus") {
        filterType = "multiSelect";
        const invCfg = filterConfig.find((f) => f.field === "invoiceStatus");
        const defaultInvOptions = [
          { label: "Raised", value: "Raised" },
          { label: "Pending", value: "Pending" },
          { label: "Invoice Raised", value: "Invoice Raised" },
          { label: "Not Raised", value: "Not Raised" },
          { label: "Need Invoice", value: "Need Invoice" },
          { label: "CANCELLED", value: "CANCELLED" },
        ];
        const combined = [...defaultInvOptions, ...(invCfg?.options || [])];
        const seen = new Set<string>();
        filterOptions = combined.filter((o) => {
          if (seen.has(o.value)) return false;
          seen.add(o.value);
          return true;
        });
      } else if (
        lowerHead === "payment status" ||
        colKey === "paymentStatus" ||
        colKey === "paymentReceivedStatus"
      ) {
        filterType = "multiSelect";
        const payCfg = filterConfig.find(
          (f) => f.field === "paymentStatus" || f.field === "paymentReceivedStatus"
        );
        const defaultPayOptions = [
          { label: "Received", value: "Received" },
          { label: "Part Paid", value: "Part Paid" },
          { label: "Not Received", value: "Not Received" },
          { label: "Payment Received", value: "Payment Received" },
          { label: "Paid", value: "Paid" },
          { label: "Unpaid", value: "Unpaid" },
          { label: "Pending", value: "Pending" },
          { label: "Outstanding", value: "Outstanding" },
          { label: "POSTED", value: "POSTED" },
          { label: "VOID", value: "VOID" },
        ];
        const combined = [...defaultPayOptions, ...(payCfg?.options || [])];
        const seen = new Set<string>();
        filterOptions = combined.filter((o) => {
          if (seen.has(o.value)) return false;
          seen.add(o.value);
          return true;
        });
      } else if (
        lowerHead === "changed by" ||
        colKey === "changedBy" ||
        lowerHead === "handled by" ||
        colKey === "handledBy" ||
        lowerHead === "bdm name" ||
        colKey === "bdmName" ||
        lowerHead === "bdm" ||
        colKey === "bdm"
      ) {
        const bdmCfg = filterConfig.find(
          (f) =>
            f.field === "bdmName" ||
            f.field === "bdm" ||
            f.field === "changedBy" ||
            f.field === "handledBy"
        );
        if (bdmCfg?.options && bdmCfg.options.length > 0) {
          filterOptions = bdmCfg.options;
        }
      } else if (
        lowerHead === "manager name" ||
        lowerHead === "manager" ||
        colKey === "managerName" ||
        colKey === "manager"
      ) {
        const mgrCfg = filterConfig.find(
          (f) => f.field === "managerName" || f.field === "manager"
        );
        if (mgrCfg?.options && mgrCfg.options.length > 0) {
          filterOptions = mgrCfg.options;
        }
      } else if (
        lowerHead === "dr. name" ||
        lowerHead === "doctor" ||
        lowerHead === "doctor name" ||
        colKey === "drName" ||
        colKey === "doctor"
      ) {
        const drCfg = filterConfig.find(
          (f) => f.field === "drName" || f.field === "doctor"
        );
        if (drCfg?.options && drCfg.options.length > 0) {
          filterOptions = drCfg.options;
        }
      } else if (lowerHead === "treatment" || colKey === "treatment") {
        const treatCfg = filterConfig.find((f) => f.field === "treatment");
        if (treatCfg?.options && treatCfg.options.length > 0) {
          filterOptions = treatCfg.options;
        }
      }
      const minBound = cfg?.min;
      const maxBound = cfg?.max;

      const currentValue = activeFilters[colKey];
      const isOnHand = lowerHead === "on hand" || (lowerHead.includes("on hand") && colKey === "quantity");

      return {
        id: `col_${idx}`,
        accessorFn: (row) => row[idx],
        sortingFn: (rowA, rowB, colId) => {
          const valA = rowA.getValue(colId);
          const valB = rowB.getValue(colId);
          const numA = typeof valA === "number" ? valA : parseFloat(String(valA).replace(/[^0-9.-]/g, "")) || 0;
          const numB = typeof valB === "number" ? valB : parseFloat(String(valB).replace(/[^0-9.-]/g, "")) || 0;
          return numA - numB;
        },
        header: ({ column }) => {
          const hasFilter = (() => {
            if (!currentValue) return false;
            if (Array.isArray(currentValue)) return currentValue.length > 0;
            if (typeof currentValue === "string") return currentValue.trim().length > 0;
            if (typeof currentValue === "object") return Boolean((currentValue as any).min || (currentValue as any).max);
            return Boolean(currentValue);
          })();

          return (
            <div className="flex items-center justify-between gap-1.5 whitespace-nowrap min-w-0">
              {hasFilter ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shadow-xs truncate">
                  {head}
                </span>
              ) : (
                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {head}
                </span>
              )}
            <div className="flex items-center gap-1 shrink-0">
              {isOnHand && (
                <button
                  type="button"
                  onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                  className={cn(
                    "inline-flex items-center justify-center p-1 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    column.getIsSorted() && "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 font-bold border-teal-200 dark:border-teal-800"
                  )}
                  title={
                    column.getIsSorted() === "asc"
                      ? "Sorted: Low to High (click for High to Low)"
                      : column.getIsSorted() === "desc"
                      ? "Sorted: High to Low (click to reset)"
                      : "Sort: Low to High / High to Low"
                  }
                >
                  {column.getIsSorted() === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  ) : column.getIsSorted() === "desc" ? (
                    <ArrowDown className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                  )}
                </button>
              )}
              {!isAction && (
                <ColumnFilter
                  type={filterType}
                  options={filterOptions}
                  min={minBound}
                  max={maxBound}
                  value={currentValue}
                  onChange={(val) => setFilter(colKey, val)}
                  placeholder={filterType === "search" ? `Search ${head}...` : `Filter ${head}...`}
                />
              )}
            </div>
          </div>
        );
      },
        cell: ({ row }) => (
          <div className="text-slate-800 dark:text-slate-200">
            {row.original[idx]}
          </div>
        ),
      };
    });
  }, [heads, filterConfig, activeFilters, setFilter, tabKey]);

  return (
    <div className="w-full max-w-full overflow-x-auto min-w-0">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={empty}
        enablePagination={enablePagination}
        initialPageSize={initialPageSize}
        pageSizeOptions={pageSizeOptions}
        columnVisibility={rbacColumnVisibility}
        tableContainerClassName="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-xs overflow-x-auto w-full max-w-full"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption: string;
}) {
  return (
    <article className="relative overflow-hidden border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-2xs hover:shadow-xs transition-all">
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{label}</span>
      <strong className="block text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 my-0.5 break-words">{value}</strong>
      <small className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{caption}</small>
    </article>
  );
}

function InventoryDateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const initialRange = useMemo<DateRange | undefined>(() => {
    if (!from) return undefined;
    const parsedFrom = parseISO(from);
    if (!isValid(parsedFrom)) return undefined;
    const parsedTo = to ? parseISO(to) : parsedFrom;
    return {
      from: parsedFrom,
      to: isValid(parsedTo) ? parsedTo : parsedFrom,
    };
  }, [from, to]);

  const [tempRange, setTempRange] = useState<DateRange | undefined>(initialRange);

  useEffect(() => {
    setTempRange(initialRange);
  }, [initialRange, open]);

  const hasRange = Boolean(from || to);

  const label = useMemo(() => {
    if (from && to) {
      const pFrom = parseISO(from);
      const pTo = parseISO(to);
      if (isValid(pFrom) && isValid(pTo)) {
        if (from === to) return format(pFrom, "dd MMM yy");
        return `${format(pFrom, "dd MMM")} – ${format(pTo, "dd MMM yy")}`;
      }
    } else if (from) {
      const pFrom = parseISO(from);
      if (isValid(pFrom)) return `From ${format(pFrom, "dd MMM")}`;
    } else if (to) {
      const pTo = parseISO(to);
      if (isValid(pTo)) return `Until ${format(pTo, "dd MMM")}`;
    }
    return "Date range";
  }, [from, to]);

  const applyRange = (range: DateRange | undefined) => {
    if (range?.from) {
      const f = format(range.from, "yyyy-MM-dd");
      const t = range.to ? format(range.to, "yyyy-MM-dd") : f;
      onChange(f, t);
    } else {
      onChange("", "");
    }
    setOpen(false);
  };

  const handleClear = () => {
    setTempRange(undefined);
    onChange("", "");
    setOpen(false);
  };

  const setPreset = (preset: "thisMonth" | "last30Days" | "3months") => {
    const now = new Date();
    let nFrom: Date;
    let nTo: Date = now;
    if (preset === "thisMonth") {
      nFrom = startOfMonth(now);
      nTo = endOfMonth(now);
    } else if (preset === "last30Days") {
      nFrom = subDays(now, 30);
    } else {
      nFrom = subMonths(now, 3);
    }
    setTempRange({ from: nFrom, to: nTo });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer select-none",
            hasRange
              ? "border-teal-500/60 bg-teal-50/60 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 font-semibold shadow-2xs"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
          )}
        >
          <Calendar className={cn("h-3.5 w-3.5 shrink-0", hasRange ? "text-teal-600 dark:text-teal-400" : "text-slate-400")} />
          <span className="truncate max-w-[140px]">{label}</span>
          {hasRange ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date range"
              className="ml-0.5 p-0.5 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <span className="text-[9px] text-slate-400">▼</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[300px] p-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl overflow-hidden">
        <div className="flex flex-col w-full">
          <div className="grid grid-cols-3 gap-1.5 p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <button
              type="button"
              className="h-7 text-[11px] px-2 rounded-lg font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs text-center cursor-pointer"
              onClick={() => setPreset("thisMonth")}
            >
              This Month
            </button>
            <button
              type="button"
              className="h-7 text-[11px] px-2 rounded-lg font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs text-center cursor-pointer"
              onClick={() => setPreset("last30Days")}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              className="h-7 text-[11px] px-2 rounded-lg font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs text-center cursor-pointer"
              onClick={() => setPreset("3months")}
            >
              3 Months
            </button>
          </div>
          <div className="p-3 w-full">
            <CalendarPicker
              mode="range"
              selected={tempRange}
              onSelect={setTempRange}
              numberOfMonths={1}
              className="p-0 w-full"
              classNames={{
                root: "w-full",
                months: "w-full",
                month: "w-full space-y-2",
                table: "w-full border-collapse space-y-1",
                weekdays: "flex w-full justify-between mb-1",
                weekday: "text-muted-foreground w-8 text-center font-normal text-[0.8rem] select-none",
                week: "flex w-full mt-1 justify-between",
                day: "h-8 w-8 text-center text-xs p-0 relative focus-within:relative focus-within:z-20 data-[range-middle=true]:bg-teal-500/15 data-[range-middle=true]:text-teal-800 dark:data-[range-middle=true]:text-teal-200 data-[range-start=true]:bg-teal-600 data-[range-start=true]:text-white data-[range-end=true]:bg-teal-600 data-[range-end=true]:text-white data-[selected-single=true]:bg-teal-600 data-[selected-single=true]:text-white rounded-lg flex items-center justify-center font-medium",
                today: "bg-accent text-accent-foreground font-bold rounded-lg",
                outside: "text-muted-foreground opacity-40",
                disabled: "text-muted-foreground opacity-40",
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => applyRange(tempRange)}
              className="h-7 px-3.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-2xs"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface InventoryModuleProps {
  apiBase?: string;
  initialTab?: Tab;
}

export default function InventoryModule({
  apiBase = "/api/inventory",
  initialTab = "Overview",
}: InventoryModuleProps) {
  const { hasAccess, permissionsReady } = usePermissions();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const subTabParam = searchParams?.get("subTab");
  const [salesSubTab, setSalesSubTab] = useState<"product" | "finance">(
    subTabParam === "finance" ? "finance" : "product"
  );
  const [snapshot, setSnapshot] = useState<Snapshot>(),
    [tab, setTab] = useState<Tab>(initialTab),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [form, setForm] = useState<FormRequest>(),
    [detail, setDetail] = useState<{ title: string; body: ReactNode }>(),
    [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [stockStatus, setStockStatus] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [productFilter, setProductFilter] = useState(""),
    [paymentView, setPaymentView] = useState<"SALE" | "PURCHASE" | "HISTORY">(
      "SALE",
    ),
    [circleFilter, setCircleFilter] = useState(""),
    [invoiceFilter, setInvoiceFilter] = useState(""),
    [paymentFilter, setPaymentFilter] = useState(""),
    [audit, setAudit] = useState<Audit[]>([]),
    [moreAudit, setMoreAudit] = useState(true);

  const getSaleCircle = useCallback((sale: Sale): string => {
    if (sale.circle?.trim()) return sale.circle.trim();
    const locName = snapshot?.state?.locations?.find((l) => l.id === sale.locationId)?.name || "";
    const locAddress = snapshot?.state?.locations?.find((l) => l.id === sale.locationId)?.address || "";
    const textToSearch = `${sale.hospitalName || ""} ${sale.billedTo || ""} ${locName} ${locAddress}`.toLowerCase();
    for (const c of ["Pune", "Mumbai", "Delhi", "Bangalore", "Hyderabad"]) {
      if (textToSearch.includes(c.toLowerCase())) return c;
    }
    return "";
  }, [snapshot?.state?.locations]);

  const circleOptions = useMemo(() => {
    const map = new Map<string, string>();
    ["Pune", "Mumbai", "Delhi", "Bangalore", "Hyderabad"].forEach((c) => {
      map.set(c.toLowerCase(), c);
    });
    (snapshot?.state?.sales || []).forEach((sale) => {
      const c = getSaleCircle(sale);
      if (c) {
        const key = c.toLowerCase();
        if (!map.has(key)) {
          const formatted = c.charAt(0).toUpperCase() + c.slice(1);
          map.set(key, formatted);
        }
      }
    });
    return Array.from(map.values()).sort();
  }, [snapshot?.state?.sales, getSaleCircle]);

  const matchesDateRange = useCallback(
    (item: { date?: string; createdAt?: string } | null | undefined): boolean => {
      if (!from && !to) return true;
      if (!item) return true;
      const rawDate = item.date || item.createdAt || "";
      if (!rawDate) return true;
      const itemDate = rawDate.slice(0, 10);
      if (from && itemDate < from) return false;
      if (to && itemDate > to) return false;
      return true;
    },
    [from, to]
  );

  const pending = useRef<{ key: string; requestId: string } | undefined>(
      undefined,
    ),
    proof = useRef<{ file: File; id: string; revision: number } | undefined>(
      undefined,
    );

  useEffect(() => {
    if (tabParam) {
      const match = tabs.find(
        ([t]) => t.toLowerCase() === tabParam.toLowerCase() || t === tabParam
      );
      if (match) {
        setTab(match[0] as Tab);
        setActiveFilters({});
      }
    }
  }, [tabParam]);

  useEffect(() => {
    if (subTabParam === "finance" || subTabParam === "product") {
      setSalesSubTab(subTabParam);
      setActiveFilters({});
    }
  }, [subTabParam]);

  const fetchJSON = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok)
      throw Object.assign(new Error(data.error || "Request failed."), {
        status: r.status,
      });
    return data;
  }, []);

  const [filterConfig, setFilterConfig] = useState<FilterConfigItem[]>([]);
  const [tableStatusConfig, setTableStatusConfig] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchJSON("/api/inventory/filter-config")
      .then((res) => {
        if (res?.filters && Array.isArray(res.filters)) {
          setFilterConfig(res.filters);
        }
        if (res?.tableStatuses && typeof res.tableStatuses === "object") {
          setTableStatusConfig(res.tableStatuses);
        }
      })
      .catch((err) => console.error("Failed to fetch filter config:", err));
  }, [fetchJSON]);

  const setFilter = useCallback((field: string, value: any) => {
    setActiveFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFrom("");
    setTo("");
    setProductFilter("");
    setCircleFilter("");
    setInvoiceFilter("");
    setPaymentFilter("");
    setActiveFilters({});
  }, []);

  const serializedFilters = useMemo(() => {
    const list: Array<{ field: string; operator: string; value: unknown }> = [];
    for (const [field, val] of Object.entries(activeFilters)) {
      if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) continue;
      const cfg = filterConfig.find((f) => f.field === field);
      const fType = cfg?.filterType;

      if (typeof val === "string") {
        if (val.trim()) {
          list.push({ field, operator: "contains", value: val.trim() });
        }
      } else if (Array.isArray(val)) {
        if (fType === "dateRange" || (val.length === 2 && typeof val[0] === "string" && val[0].includes("-"))) {
          list.push({ field, operator: "between", value: val });
        } else {
          list.push({ field, operator: "in", value: val });
        }
      } else if (typeof val === "object" && val !== null && (val.min != null || val.max != null)) {
        list.push({ field, operator: "between", value: val });
      } else if (typeof val === "boolean") {
        list.push({ field, operator: "eq", value: val });
      }
    }
    return list;
  }, [activeFilters, filterConfig]);

  const currentTab =
    tab === "Sales"
      ? salesSubTab === "finance"
        ? "Sales Finance"
        : "Sales Product"
      : tab;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const tabQuery = currentTab ? `tab=${encodeURIComponent(currentTab)}` : "";
      const filterQuery =
        serializedFilters.length > 0
          ? `filters=${encodeURIComponent(JSON.stringify(serializedFilters))}`
          : "";
      const queryParts = [tabQuery, filterQuery].filter(Boolean).join("&");
      const url = queryParts ? `${apiBase}?${queryParts}` : apiBase;
      const data: Snapshot = await fetchJSON(url);
      setSnapshot(data);
      setAudit(data.audit);
      setMoreAudit(data.audit.length === 100);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetchJSON, serializedFilters, currentTab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  async function save(command: Command, file?: File) {
    if (!snapshot) return;
    let revision = snapshot.state.revision;
    let complete: Command = command;
    if (file && "proofId" in command) {
      if (proof.current?.file !== file) {
        const body = new FormData();
        body.set("file", file);
        const uploaded = await fetchJSON(`${apiBase}/attachments`, {
          method: "POST",
          body,
        });
        proof.current = {
          file,
          id: uploaded.attachment.id,
          revision: uploaded.revision,
        };
        revision = uploaded.revision;
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                state: {
                  ...prev.state,
                  revision,
                  attachments: [...prev.state.attachments, uploaded.attachment],
                },
              }
            : prev,
        );
      } else revision = Math.max(revision, proof.current.revision);
      complete = { ...command, proofId: proof.current!.id };
    }
    const key = JSON.stringify({ revision, complete });
    if (pending.current?.key !== key)
      pending.current = { key, requestId: crypto.randomUUID() };
    try {
      await fetchJSON(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: pending.current.requestId,
          expectedRevision: revision,
          command: complete,
        }),
      });
      pending.current = undefined;
      proof.current = undefined;
      setNotice("Saved. Stock, balances and activity are up to date.");
      await refresh();
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        pending.current = undefined;
        await refresh();
      }
      throw e;
    }
  }

  const router = useRouter();

  function navigate(next: Tab) {
    setTab(next);
    setQuery("");
    setLocation("");
    setStockStatus("");
    setActiveFilters({});
    router.push(`/inventory?tab=${encodeURIComponent(next)}`);
  }

  function open(request: FormRequest) {
    proof.current = undefined;
    pending.current = undefined;
    setForm(request);
  }

  if (!snapshot)
    return (
      <div className="w-full">
        <header className="sticky top-0 z-20 bg-background/80 px-4 py-2 backdrop-blur-xl dark:bg-background/80 md:px-6 shrink-0 w-full min-w-0">
          <div className="flex items-center justify-between gap-4 w-full min-w-0">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">
                Inventory
              </h1>
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden p-12 text-center">
            {loading ? (
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading inventory…</div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Inventory is unavailable</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
                <Button onClick={() => void refresh()}>
                  Retry connection
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );

  const currentTabAllowed = hasAccess(TAB_RESOURCE_KEYS[tab], "READ");

  if (!currentTabAllowed && permissionsReady) {
    return (
      <div className="w-full p-8 text-center">
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You do not have permission to view the <strong>{tab}</strong> tab. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const s: InventoryState = snapshot.state,
    actorName = snapshot.actor.name,
    write = snapshot.actor.permissions.includes("write"),
    admin = snapshot.actor.permissions.includes("admin"),
    totals = dashboard(s),
    today = todayIndia();

  const name = (kind: MasterKind, id: string) =>
    s[kind].find((x) => x.id === id)?.name ?? "Unknown record";

  const filteredDate = (date: string) =>
    (!from || date >= from) && (!to || date <= to);

  const matches = (...values: unknown[]) =>
    values.join(" ").toLowerCase().includes(query.toLowerCase());

  const button = (label: string, request: FormRequest, danger = false) =>
    write ? (
      <Button
        variant={danger ? "destructive" : "outline"}
        size="sm"
        onClick={() => open(request)}
      >
        {label}
      </Button>
    ) : null;

  const link = (label: string, callback: () => void) => (
    <button
      className="border-0 bg-transparent text-teal-700 dark:text-teal-400 font-semibold text-xs px-1.5 py-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
      onClick={callback}
    >
      {label}
    </button>
  );

  const paymentButton = (doc: Purchase | Sale, kind: "PURCHASE" | "SALE") =>
    doc.status === "POSTED" && paid(s, doc.id) < doc.total
      ? button(kind === "SALE" ? "Collect" : "Pay", {
          kind: "payment",
          id: doc.id,
          defaults: {
            documentKind: kind,
            amount: moneyInput(doc.total - paid(s, doc.id)),
            handledBy: snapshot.actor.name,
          },
        })
      : null;

  const attachment = (id: string) =>
    id ? (
      <a
        href={`${apiBase}/attachments/${id}`}
        className="border-0 bg-transparent text-teal-700 dark:text-teal-400 font-semibold text-xs px-1.5 py-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
      >
        Download proof
      </a>
    ) : (
      <span className="text-slate-400 dark:text-slate-500">—</span>
    );

  function docDetail(
    doc: Purchase | Sale,
    kind: "PURCHASE" | "SALE" | "SALE_PRODUCT" | "SALE_FINANCE",
  ) {
    if (kind === "SALE_PRODUCT") {
      const sDoc = doc as Sale;
      const totalVal = sDoc.salesPriceWithGst || sDoc.total;
      const paidVal = (sDoc.receivedPayment !== undefined && sDoc.receivedPayment > 0) ? sDoc.receivedPayment : paid(s, sDoc.id);
      const outstandingVal = Math.max(0, totalVal - paidVal);
      const hasPricing = Boolean(
        (sDoc.salesPrice !== undefined && sDoc.salesPrice > 0) ||
        (sDoc.salesPriceWithGst !== undefined && sDoc.salesPriceWithGst > 0) ||
        (sDoc.lines && sDoc.lines.some((l) => l.unitPrice !== undefined && l.unitPrice > 0)) ||
        sDoc.invoiceStatus === "Raised" ||
        sDoc.invoiceStatus === "Invoice Raised"
      );

      const isInvoiceRaised = sDoc.invoiceStatus === "Raised" || sDoc.invoiceStatus === "Invoice Raised" || Boolean(sDoc.reference);
      const invoiceStatusText = hasPricing ? (isInvoiceRaised ? "Raised" : "Pending") : (sDoc.invoiceStatus || "—");

      const isPaid = sDoc.paymentReceivedStatus === "Received" || sDoc.paymentReceivedStatus === "Payment Received" || (paidVal >= totalVal && totalVal > 0);
      const isPartPaid = !isPaid && (sDoc.paymentReceivedStatus === "Part Paid" || paidVal > 0);
      const paymentStatusText = hasPricing ? (isPaid ? "Received" : isPartPaid ? "Part Paid" : "Not Received") : "—";

      setDetail({
        title: `Sales Product Details (${short(doc.id)})`,
        body: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
              {Object.entries({
                "Case / IPD Ref": sDoc.caseReference || "—",
                Date: sDoc.date,
                "Surgery Date": sDoc.surgeryDate || sDoc.date || "—",
                "Patient Name": sDoc.patientName || sDoc.billedTo || "—",
                "BDM Name": sDoc.bdmName || "—",
                "Manager Name": sDoc.managerName || "—",
                Treatment: sDoc.treatment || "—",
                Circle: sDoc.circle || "—",
                "Hospital Name": sDoc.hospitalName || name("locations", sDoc.locationId) || "—",
                "Dr. Name": sDoc.drName || "—",
                MOP: sDoc.mop || "—",
                Remark: sDoc.remark || "—",
                "Invoice Status": invoiceStatusText,
                "Total Price": hasPricing ? money(sDoc.salesPrice || sDoc.net) : "—",
                "GST Amount": hasPricing ? money(sDoc.gstAmount ?? sDoc.tax) : "—",
                "Total Price with GST": hasPricing ? money(totalVal) : "—",
                "Received Payment": hasPricing ? money(paidVal) : "—",
                "Payment Status": paymentStatusText,
                Outstanding: hasPricing ? money(outstandingVal) : "—",
                "Handled by": sDoc.handledBy || "—",
              }).map(([k, v]) => (
                <div key={k}>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{k}</small>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">{v}</strong>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">
              Items in this Sale & Price Breakdown ({sDoc.lines?.length || 0})
            </h3>
            <Table
              enablePagination={false}
              heads={[
                "Item / batch",
                "Size",
                "Qty",
                "MRP",
                "Buy Price",
                "Sales Price",
                "GST %",
                "GST Amount",
                "Total with GST",
              ]}
              rows={
                sDoc.lines && sDoc.lines.length > 0
                  ? sDoc.lines.map((l) => {
                      const saleLine = l as any;
                      const prod = s.products.find((p) => p.id === saleLine.productId);
                      const mrpVal = saleLine.mrp || prod?.mrp || 0;
                      const gstPct = saleLine.gstPercent ?? 0;
                      const gstAmt =
                        saleLine.gstAmount ??
                        ((saleLine.unitPrice || 0) * (saleLine.quantity || 1) * (gstPct / 100));
                      const lineNet = (saleLine.unitPrice || 0) * (saleLine.quantity || 1);
                      const lineTotal = lineNet + gstAmt;

                      return [
                        <div key="item">
                          <strong className="font-semibold block text-slate-900 dark:text-slate-100">
                            {saleLine.productName || prod?.name || "Item"}
                          </strong>
                          {saleLine.batch && (
                            <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                              Batch: {saleLine.batch}
                            </small>
                          )}
                        </div>,
                        saleLine.size || "—",
                        saleLine.quantity,
                        hasPricing && mrpVal > 0 ? money(mrpVal) : "—",
                        hasPricing && saleLine.unitCost > 0 ? money(saleLine.unitCost) : "—",
                        hasPricing && saleLine.unitPrice > 0 ? money(saleLine.unitPrice) : "—",
                        hasPricing ? (gstPct > 0 ? `${gstPct}%` : "0%") : "—",
                        hasPricing ? (gstAmt > 0 ? money(gstAmt) : "₹0.00") : "—",
                        hasPricing ? (lineTotal > 0 ? money(lineTotal) : "₹0.00") : "—",
                      ];
                    })
                  : [
                      [
                        sDoc.stockUsedForm || "—",
                        sDoc.sizeUsed || "—",
                        1,
                        "—",
                        "—",
                        "—",
                        "—",
                        "—",
                        "—",
                      ],
                    ]
              }
            />
            {hasPricing && s.payments.some((p) => p.documentId === doc.id) && (
              <>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">Payments</h3>
                <Table
                  enablePagination={false}
                  heads={["Date", "Amount", "Method", "Handled by", "Proof"]}
                  rows={s.payments
                    .filter((p) => p.documentId === doc.id)
                    .map((p) => [
                      p.date,
                      money(p.amount),
                      p.method.replaceAll("_", " "),
                      p.handledBy,
                      attachment(p.proofId),
                    ])}
                />
              </>
            )}
            {sDoc.proofId && (
              <p className="text-xs text-slate-600 dark:text-slate-400 pt-2">
                Attachment / Proof: {attachment(sDoc.proofId)}
              </p>
            )}
          </div>
        ),
      });
      return;
    }

    if (kind === "SALE_FINANCE") {
      const sDoc = doc as Sale;
      const totalVal = sDoc.salesPriceWithGst || sDoc.total;
      const paidVal = (sDoc.receivedPayment !== undefined && sDoc.receivedPayment > 0) ? sDoc.receivedPayment : paid(s, sDoc.id);
      const outstandingVal = Math.max(0, totalVal - paidVal);

      setDetail({
        title: `Sales Finance Details (${short(doc.id)})`,
        body: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
              {Object.entries({
                "Patient / Billed to": sDoc.patientName || sDoc.billedTo || "—",
                Date: sDoc.date,
                "Case Reference No.": sDoc.caseReference || "—",
                "Hospital Name": sDoc.hospitalName || name("locations", sDoc.locationId) || "—",
                "Invoice Status": (sDoc.invoiceStatus === "Raised" || sDoc.invoiceStatus === "Invoice Raised" || Boolean(sDoc.reference)) ? "Raised" : "Pending",
                "Total Price": money(sDoc.salesPrice || sDoc.net),
                "GST Amount": money(sDoc.gstAmount ?? sDoc.tax),
                "Total Price with GST": money(totalVal),
                "Received Payment": money(paidVal),
                "Payment Status": (sDoc.paymentReceivedStatus === "Received" || sDoc.paymentReceivedStatus === "Payment Received" || (paidVal >= totalVal && totalVal > 0)) ? "Received" : (sDoc.paymentReceivedStatus === "Part Paid" || paidVal > 0) ? "Part Paid" : "Not Received",
                Outstanding: money(outstandingVal),
                "Handled by": sDoc.handledBy || "—",
              }).map(([k, v]) => (
                <div key={k}>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{k}</small>
                  <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">{v}</strong>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">
              Items in this Sale & Price Breakdown ({sDoc.lines?.length || 0})
            </h3>
            <Table
              enablePagination={false}
              heads={[
                "Item / batch",
                "Size",
                "Qty",
                "MRP",
                "Buy Price",
                "Sales Price",
                "GST %",
                "GST Amount",
                "Total with GST",
              ]}
              rows={sDoc.lines.map((l) => {
                const saleLine = l as any;
                const prod = s.products.find((p) => p.id === saleLine.productId);
                const mrpVal = saleLine.mrp || prod?.mrp || 0;
                const gstPct = saleLine.gstPercent ?? 0;
                const gstAmt =
                  saleLine.gstAmount ??
                  ((saleLine.unitPrice || 0) * (saleLine.quantity || 1) * (gstPct / 100));
                const lineNet = (saleLine.unitPrice || 0) * (saleLine.quantity || 1);
                const lineTotal = lineNet + gstAmt;

                return [
                  <div key="item">
                    <strong className="font-semibold block text-slate-900 dark:text-slate-100">
                      {saleLine.productName || prod?.name || "Item"}
                    </strong>
                    {saleLine.batch && (
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Batch: {saleLine.batch}
                      </small>
                    )}
                  </div>,
                  saleLine.size || "—",
                  saleLine.quantity,
                  mrpVal > 0 ? money(mrpVal) : "—",
                  saleLine.unitCost > 0 ? money(saleLine.unitCost) : "—",
                  saleLine.unitPrice > 0 ? money(saleLine.unitPrice) : "—",
                  gstPct > 0 ? `${gstPct}%` : "0%",
                  gstAmt > 0 ? money(gstAmt) : "₹0.00",
                  lineTotal > 0 ? money(lineTotal) : "₹0.00",
                ];
              })}
            />
            {s.payments.some((p) => p.documentId === doc.id) && (
              <>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">Payments</h3>
                <Table
                  enablePagination={false}
                  heads={["Date", "Amount", "Method", "Handled by", "Proof"]}
                  rows={s.payments
                    .filter((p) => p.documentId === doc.id)
                    .map((p) => [
                      p.date,
                      money(p.amount),
                      p.method.replaceAll("_", " "),
                      p.handledBy,
                      attachment(p.proofId),
                    ])}
                />
              </>
            )}
            {sDoc.proofId && (
              <p className="text-xs text-slate-600 dark:text-slate-400 pt-2">
                Attachment / Proof: {attachment(sDoc.proofId)}
              </p>
            )}
          </div>
        ),
      });
      return;
    }

    setDetail({
      title: `${kind === "SALE" ? "Sale" : "Purchase"} ${short(doc.id)}`,
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            {Object.entries(
              kind === "SALE"
                ? {
                    Date: doc.date,
                    Location: name("locations", doc.locationId),
                    "Patient / Billed to": (doc as Sale).patientName || (doc as Sale).billedTo,
                    "Case Ref": (doc as Sale).caseReference || "—",
                    Hospital: (doc as Sale).hospitalName || "—",
                    Doctor: (doc as Sale).drName || "—",
                    BDM: (doc as Sale).bdmName || "—",
                    "Invoice Status": (doc as Sale).invoiceStatus === "Raised" || (doc as Sale).invoiceStatus === "Invoice Raised" || Boolean(doc.reference) ? "Raised" : "Pending",
                    MRP: money((doc as Sale).mrp || 0),
                    "Buy Price": money((doc as Sale).buyPrice || 0),
                    "Sales Price (Total)": money((doc as Sale).salesPrice || doc.net),
                    "GST %": (doc as Sale).gstPercent ? `${(doc as Sale).gstPercent}%` : doc.net > 0 && doc.tax > 0 ? `${Math.round((doc.tax / doc.net) * 100)}%` : "0%",
                    "GST Amount": money((doc as Sale).gstAmount ?? doc.tax),
                    "Total with GST": money((doc as Sale).salesPriceWithGst || doc.total),
                    "Payment Status": (doc as Sale).paymentReceivedStatus === "Received" || (doc as Sale).paymentReceivedStatus === "Payment Received" || (doc.total > 0 && paid(s, doc.id) >= doc.total) ? "Received" : (doc as Sale).paymentReceivedStatus === "Part Paid" || paid(s, doc.id) > 0 ? "Part Paid" : "Not Received",
                    Paid: money(paid(s, doc.id)),
                    Outstanding: money(doc.total - paid(s, doc.id)),
                    Status: doc.status,
                  }
                : {
                    Date: doc.date,
                    Location: name("locations", doc.locationId),
                    "GST treatment": doc.gstMode.replaceAll("_", " "),
                    "Document type": doc.documentType,
                    Reference: doc.reference || "—",
                    "Handled by": doc.handledBy,
                    "Net amount": money(doc.net),
                    Tax: money(doc.tax),
                    Total: money(doc.total),
                    Paid: money(paid(s, doc.id)),
                    Outstanding: money(doc.total - paid(s, doc.id)),
                    Status: doc.status,
                  },
            ).map(([k, v]) => (
              <div key={k}>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{k}</small>
                <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">{v}</strong>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">Items</h3>
          <Table
            enablePagination={false}
            heads={
              kind === "SALE"
                ? [
                    "Item / batch",
                    "Size",
                    "Qty",
                    "MRP",
                    "Buy Price",
                    "Sales Price",
                    "GST %",
                    "GST Amount",
                    "Total with GST",
                  ]
                : [
                    "Item / batch",
                    "Size",
                    "Qty",
                    "Cost / unit",
                    "Sale / unit",
                  ]
            }
            rows={doc.lines.map((l) => {
              if (kind === "SALE") {
                const saleLine = l as any;
                const prod = s.products.find((p) => p.id === saleLine.productId);
                const mrpVal = saleLine.mrp || prod?.mrp || 0;
                const gstPct = saleLine.gstPercent ?? 0;
                const gstAmt =
                  saleLine.gstAmount ??
                  ((saleLine.unitPrice || 0) * (saleLine.quantity || 1) * (gstPct / 100));
                const lineNet = (saleLine.unitPrice || 0) * (saleLine.quantity || 1);
                const lineTotal = lineNet + gstAmt;

                return [
                  <div key="item">
                    <strong className="font-semibold block text-slate-900 dark:text-slate-100">
                      {saleLine.productName || prod?.name || "Item"}
                    </strong>
                    {saleLine.batch && (
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Batch: {saleLine.batch}
                      </small>
                    )}
                  </div>,
                  saleLine.size || "—",
                  saleLine.quantity,
                  mrpVal > 0 ? money(mrpVal) : "—",
                  saleLine.unitCost > 0 ? money(saleLine.unitCost) : "—",
                  saleLine.unitPrice > 0 ? money(saleLine.unitPrice) : "—",
                  gstPct > 0 ? `${gstPct}%` : "0%",
                  gstAmt > 0 ? money(gstAmt) : "₹0.00",
                  lineTotal > 0 ? money(lineTotal) : "₹0.00",
                ];
              }

              return [
                <>
                  <strong className="font-semibold">{l.productName}</strong>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{l.batch}</small>
                </>,
                l.size,
                l.quantity,
                money(l.unitCost),
                "salePrice" in l ? money((l as any).salePrice) : "—",
              ];
            })}
          />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">Payments</h3>
          <Table
            enablePagination={false}
            heads={["Date", "Amount", "Method", "Handled by", "Proof"]}
            rows={s.payments
              .filter((p) => p.documentId === doc.id)
              .map((p) => [
                p.date,
                money(p.amount),
                p.method,
                p.handledBy,
                attachment(p.proofId),
              ])}
          />
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-2">Original document: {attachment(doc.proofId)}</p>
        </div>
      ),
    });
  }

  function transferDetail(id: string) {
    const t = s.transfers.find((t) => t.id === id)!;
    setDetail({
      title: `Transfer ${short(id)}`,
      body: (
        <div className="space-y-3 text-xs">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {name("locations", t.fromId)} → {name("locations", t.toId)}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            {t.kind.replaceAll("_", " ")} · {t.status.replaceAll("_", " ")} ·{" "}
            {t.date}
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            Case: {t.caseReference || "—"} · {t.notes || "No notes"}
          </p>
          <Table
            enablePagination={false}
            heads={["Implant", "Size", "Batch", "Units"]}
            rows={t.lines.map((l) => {
              const lot = s.lots.find((x) => x.id === l.lotId);
              const prod = lot
                ? s.products.find((p) => p.id === lot.productId)
                : s.products.find((p) => p.id === l.lotId);
              return [
                prod?.name || (lot ? name("products", lot.productId) : "Item"),
                lot?.size || "—",
                lot?.batch || "—",
                l.quantity,
              ];
            })}
          />
        </div>
      ),
    });
  }

  const reportControls = (showProduct = false) => (
    <div className="flex items-end flex-wrap gap-3 p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
        From
        <input
          type="date"
          aria-label="From date"
          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={from}
          max={to || undefined}
          onChange={(e) => {
            if (to && e.target.value > to) {
              setNotice("From must be before To.");
              return;
            }
            setFrom(e.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
        To
        <input
          type="date"
          aria-label="To date"
          className="px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={to}
          min={from || undefined}
          onChange={(e) => {
            if (from && e.target.value < from) {
              setNotice("To must be after From.");
              return;
            }
            setTo(e.target.value);
          }}
        />
      </label>
      {showProduct && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          Implant
          <select
            className="px-3 py-1.5 pr-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-no-repeat bg-[right_0.75rem_center]"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="">All implants</option>
            {s.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
        onClick={handleResetFilters}
      >
        Reset filters
      </button>
    </div>
  );

  function documentTable(kind: "PURCHASE" | "SALE", onlyOutstanding = false) {
    if (kind === "PURCHASE") {
      const purchases = s.purchases;
      return (
        <Table
          tabKey="Purchases"
          heads={[
            "Document",
            "Vendor",
            "Items & Location",
            "GST / type",
            "Total",
            "Paid",
            "Outstanding",
            "Handled by",
            "Status",
            "Actions",
          ]}
          rows={purchases
            .filter(
              (d) =>
                (!onlyOutstanding ||
                  (d.status === "POSTED" && paid(s, d.id) < d.total)) &&
                matchesDateRange(d) &&
                matches(
                  d.id,
                  d.reference,
                  name("vendors", d.vendorId),
                  name("locations", d.locationId),
                  d.handledBy,
                  ...d.lines.map((l) => l.productName || name("products", l.productId)),
                ),
            )
            .slice()
            .reverse()
            .map((d) => [
              <div key="doc">
                <strong className="font-semibold text-slate-900 dark:text-slate-100">{d.reference || short(d.id)}</strong>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{d.date}</small>
              </div>,
              name("vendors", d.vendorId),
              <div key="items" className="space-y-1 max-w-[240px]">
                <div className="space-y-0.5">
                  {d.lines.map((l, i) => (
                    <div key={i} className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate" title={`${l.productName || name("products", l.productId)}${l.size ? ` (${l.size})` : ""} × ${l.quantity}`}>
                      {l.productName || name("products", l.productId)}{l.size ? ` (${l.size})` : ""} <span className="text-slate-500 font-semibold">× {l.quantity}</span>
                    </div>
                  ))}
                </div>
                <small className="text-[11px] text-teal-700 dark:text-teal-400 font-medium block">
                  📍 {name("locations", d.locationId)}
                </small>
              </div>,
              <div key="gst">
                <Badge tone={d.gstMode === "WITH_GST" ? "blue" : "amber"}>
                  {d.gstMode === "WITH_GST" ? "With GST" : "Without GST"}
                </Badge>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{d.documentType}</small>
              </div>,
              money(d.total),
              (() => {
                const docPayments = s.payments.filter((p) => p.documentId === d.id);
                const methods = Array.from(new Set(docPayments.map((p) => p.method))).filter(Boolean);
                return (
                  <div key="paid">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">{money(paid(s, d.id))}</span>
                    {methods.length > 0 ? (
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {methods.map((m) => m.replaceAll("_", " ")).join(", ")}
                      </small>
                    ) : (
                      <small className="text-[11px] text-slate-400 dark:text-slate-500 block">—</small>
                    )}
                  </div>
                );
              })(),
              d.status === "VOID" ? "—" : money(d.total - paid(s, d.id)),
              d.handledBy || "—",
              <Badge
                key="status"
                tone={
                  d.status === "VOID"
                    ? "red"
                    : paid(s, d.id) < d.total
                      ? "amber"
                      : "green"
                }
              >
                {d.status === "VOID"
                  ? "Void"
                  : paid(s, d.id) === d.total
                    ? "Paid"
                    : paid(s, d.id) > 0
                      ? "Part paid"
                      : "Unpaid"}
              </Badge>,
              <div key="actions" className="flex gap-2 items-center flex-wrap">
                {link("Details", () => docDetail(d, "PURCHASE"))}
                {paymentButton(d, "PURCHASE")}
                {admin &&
                  d.status === "POSTED" &&
                  paid(s, d.id) === 0 &&
                  button(
                    "Void",
                    { kind: "void", id: d.id, defaults: { documentKind: "PURCHASE" } },
                    true,
                  )}
              </div>,
            ])}
        />
      );
    }

    const sales = s.sales;
    return (
      <Table
        tabKey="Sales"
        heads={[
          "Document",
          "Billed to",
          "Case ref no.",
          "Implant, Batch & Qty",
          "Unit price",
          "GST / type",
          "Total",
          "Paid",
          "Outstanding",
          "Handled by",
          "Status",
          "Actions",
        ]}
        rows={sales
          .filter(
            (d) =>
              (!onlyOutstanding ||
                (d.status === "POSTED" && paid(s, d.id) < d.total)) &&
              matchesDateRange(d) &&
              matches(
                d.id,
                d.reference,
                d.billedTo,
                d.caseReference,
                d.handledBy,
                ...d.lines.map((l) => `${l.productName || name("products", l.productId)} ${l.batch}`),
              ),
          )
          .slice()
          .reverse()
          .map((d) => [
            <div key="doc">
              <strong className="font-semibold text-slate-900 dark:text-slate-100">{d.reference || short(d.id)}</strong>
              <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{d.date}</small>
            </div>,
            d.billedTo || "—",
            <span key="case" className="text-xs font-medium text-slate-900 dark:text-slate-100">
              {d.caseReference || "—"}
            </span>,
            <div key="items" className="space-y-1 max-w-[240px]">
              {d.lines.map((l, i) => (
                <div key={i} className="text-xs">
                  <strong className="font-semibold text-slate-900 dark:text-slate-100 block truncate" title={l.productName || name("products", l.productId)}>
                    {l.productName || name("products", l.productId)}{l.size ? ` (${l.size})` : ""}
                  </strong>
                  <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Batch: {l.batch || "—"} · <span className="font-semibold text-slate-700 dark:text-slate-300">Qty: {l.quantity}</span>
                  </small>
                </div>
              ))}
            </div>,
            <div key="unitPrice" className="space-y-0.5">
              {d.lines.map((l, i) => (
                <div key={i} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {money(l.unitPrice)}
                </div>
              ))}
            </div>,
            <div key="gst">
              <Badge tone={d.gstMode === "WITH_GST" ? "blue" : "amber"}>
                {d.gstMode === "WITH_GST" ? "With GST" : "Without GST"}
              </Badge>
              <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{d.documentType}</small>
            </div>,
            money(d.total),
            (() => {
              const docPayments = s.payments.filter((p) => p.documentId === d.id);
              const methods = Array.from(new Set(docPayments.map((p) => p.method))).filter(Boolean);
              return (
                <div key="paid">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">{money(paid(s, d.id))}</span>
                  {methods.length > 0 ? (
                    <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      {methods.map((m) => m.replaceAll("_", " ")).join(", ")}
                    </small>
                  ) : (
                    <small className="text-[11px] text-slate-400 dark:text-slate-500 block">—</small>
                  )}
                </div>
              );
            })(),
            d.status === "VOID" ? "—" : money(d.total - paid(s, d.id)),
            d.handledBy || "—",
            <Badge
              key="status"
              tone={
                d.status === "VOID"
                  ? "red"
                  : paid(s, d.id) < d.total
                    ? "amber"
                    : "green"
              }
            >
              {d.status === "VOID"
                ? "Void"
                : paid(s, d.id) === d.total
                  ? "Paid"
                  : paid(s, d.id) > 0
                    ? "Part paid"
                    : "Unpaid"}
            </Badge>,
            <div key="actions" className="flex gap-2 items-center flex-wrap">
              {link("Details", () => docDetail(d, "SALE"))}
              {paymentButton(d, "SALE")}
              {admin &&
                d.status === "POSTED" &&
                paid(s, d.id) === 0 &&
                button(
                  "Void",
                  { kind: "void", id: d.id, defaults: { documentKind: "SALE" } },
                  true,
                )}
            </div>,
          ])}
      />
    );
  }

  function salesProductTable() {
    const sales = s.sales;
    return (
      <Table
        tabKey="Sales"
        heads={[
          "Date",
          "Patient Name",
          "BDM Name",
          "Manager Name",
          "Treatment",
          "Circle",
          "Dr. Name",
          "Hospital Name",
          "Surgery Date",
          "MOP",
          "Items",
          "Remark",
          "Actions",
        ]}
        rows={sales
          .filter((d) => {
            if (!matchesDateRange(d)) return false;
            if (circleFilter) {
              const rowCircle = getSaleCircle(d);
              if (!rowCircle || rowCircle.toLowerCase() !== circleFilter.trim().toLowerCase()) {
                return false;
              }
            }
            return matches(
              d.id,
              d.date,
              d.reference,
              d.billedTo,
              d.caseReference,
              d.handledBy,
              d.bdmName,
              d.managerName,
              d.patientName,
              d.treatment,
              d.circle,
              getSaleCircle(d),
              d.drName,
              d.hospitalName,
              d.surgeryDate,
              d.mop,
              d.sizeUsed,
              d.remark,
              d.stockUsedForm,
              ...d.lines.map((l) => `${l.productName || name("products", l.productId)} ${l.batch}`),
            );
          })
          .slice()
          .reverse()
          .map((d) => [
            <div key="date">
              <strong className="font-semibold text-slate-900 dark:text-slate-100">{d.date}</strong>
              {d.caseReference && (
                <span className="block text-[11px] text-teal-600 dark:text-teal-400 font-mono mt-0.5">
                  Ref: {d.caseReference}
                </span>
              )}
            </div>,
            d.patientName || d.billedTo || "—",
            d.bdmName || d.handledBy || "—",
            d.managerName || "—",
            d.treatment || "—",
            getSaleCircle(d) || "—",
            d.drName || "—",
            d.hospitalName || name("locations", d.locationId) || "—",
            d.surgeryDate || d.date || "—",
            d.mop || String(s.payments.find((p) => p.documentId === d.id)?.method || "—").replace(/_/g, " "),
            <div key="items" className="text-xs space-y-1.5 min-w-[150px] max-w-[220px]">
              {d.lines && d.lines.length > 0 ? (
                d.lines.map((l, idx) => (
                  <div key={idx} className="border-b border-slate-100 dark:border-slate-800/60 pb-1 last:border-0 last:pb-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={l.productName || name("products", l.productId) || "Item"}>
                      {l.productName || name("products", l.productId) || "Item"}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      {l.size && <span>Size: {l.size}</span>}
                      {l.batch && <span>Batch: {l.batch}</span>}
                      <span>Qty: {l.quantity}</span>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-slate-600 dark:text-slate-300">
                  {d.stockUsedForm || d.sizeUsed || "—"}
                </span>
              )}
            </div>,
            d.remark || d.caseReference || "—",
            <div key="actions" className="flex flex-row items-center gap-1.5 flex-nowrap whitespace-nowrap">
              {paymentButton(d, "SALE")}
              {link("Details", () => docDetail(d, "SALE_PRODUCT"))}
              {button("Edit", { kind: "saleProduct", id: d.id })}
              {admin &&
                d.status === "POSTED" &&
                paid(s, d.id) === 0 &&
                button(
                  "Void",
                  { kind: "void", id: d.id, defaults: { documentKind: "SALE" } },
                  true,
                )}
            </div>,
          ])}
      />
    );
  }

  function salesFinanceTable() {
    const sales = s.sales;
    return (
      <Table
        tabKey="Sales"
        heads={[
          "Patient Name",
          "Case Reference No.",
          "Hospital Name",
          "Items",
          "MRP",
          "Buy Price",
          "Sales Price",
          "Sales Price with GST",
          "Invoice Status",
          "Payment Status",
          "Actions",
        ]}
        rows={sales
          .filter((d) => {
            if (!matchesDateRange(d)) return false;
            const isInvoiceRaised = d.invoiceStatus === "Raised" || d.invoiceStatus === "Invoice Raised" || Boolean(d.reference);
            const invStatus = isInvoiceRaised ? "Raised" : "Pending";
            if (invoiceFilter && invStatus.toLowerCase() !== invoiceFilter.toLowerCase()) {
              return false;
            }

            const totalAmt = d.salesPriceWithGst || d.total;
            const paidAmt = d.receivedPayment !== undefined && d.receivedPayment > 0 ? d.receivedPayment : paid(s, d.id);
            const isPaid = d.paymentReceivedStatus === "Received" || d.paymentReceivedStatus === "Payment Received" || (paidAmt >= totalAmt && totalAmt > 0);
            const isPartPaid = !isPaid && (d.paymentReceivedStatus === "Part Paid" || paidAmt > 0);
            const payStatus = isPaid ? "Received" : isPartPaid ? "Part Paid" : "Not Received";
            if (paymentFilter && payStatus.toLowerCase() !== paymentFilter.toLowerCase()) {
              return false;
            }
            return true;
          })
          .filter(
            (d) =>
              matches(
                d.id,
                d.reference,
                d.billedTo,
                d.patientName,
                d.caseReference,
                d.hospitalName,
                d.invoiceStatus,
                d.paymentReceivedStatus,
                d.handledBy,
                d.stockUsedForm,
                d.sizeUsed,
                ...d.lines.map((l) => `${l.productName || name("products", l.productId)} ${l.batch}`),
              ),
          )
          .slice()
          .reverse()
          .map((d) => {
            const mrpVal = d.mrp ?? d.lines.reduce((sum, l) => sum + (s.products.find((p) => p.id === l.productId)?.mrp || 0) * l.quantity, 0);
            const buyPriceVal = d.buyPrice ?? d.lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
            const salesPriceVal = d.salesPrice ?? d.net;
            const salesPriceWithGstVal = d.salesPriceWithGst ?? d.total;

            const isInvoiceRaised = d.invoiceStatus === "Raised" || d.invoiceStatus === "Invoice Raised" || Boolean(d.reference);
            const invoiceStatusText = isInvoiceRaised ? "Raised" : "Pending";

            const totalAmt = d.salesPriceWithGst || d.total;
            const paidAmt = d.receivedPayment !== undefined && d.receivedPayment > 0 ? d.receivedPayment : paid(s, d.id);
            const isPaid = d.paymentReceivedStatus === "Received" || d.paymentReceivedStatus === "Payment Received" || (paidAmt >= totalAmt && totalAmt > 0);
            const isPartPaid = !isPaid && (d.paymentReceivedStatus === "Part Paid" || paidAmt > 0);
            const paymentStatusText = isPaid ? "Received" : isPartPaid ? "Part Paid" : "Not Received";

            return [
              <div key="pat" className="space-y-1">
                <strong className="font-semibold text-slate-900 dark:text-slate-100 block">{d.patientName || d.billedTo || "Patient"}</strong>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{d.date}</span>
                  {d.reference && <span>• Ref: {d.reference}</span>}
                </div>
              </div>,
              d.caseReference ? (
                <span key="ref" className="font-mono text-xs text-teal-600 dark:text-teal-400 font-medium">
                  {d.caseReference}
                </span>
              ) : (
                "—"
              ),
              <span key="hosp" className="text-xs text-slate-800 dark:text-slate-200">
                {d.hospitalName || name("locations", d.locationId) || "—"}
              </span>,
              <div key="items" className="text-xs space-y-1.5 min-w-[150px] max-w-[220px]">
                {d.lines && d.lines.length > 0 ? (
                  d.lines.map((l, idx) => (
                    <div key={idx} className="border-b border-slate-100 dark:border-slate-800/60 pb-1 last:border-0 last:pb-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={l.productName || name("products", l.productId) || "Item"}>
                        {l.productName || name("products", l.productId) || "Item"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        {l.size && <span>Size: {l.size}</span>}
                        <span>Qty: {l.quantity}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-600 dark:text-slate-300">
                    {d.stockUsedForm || d.sizeUsed || "—"}
                  </span>
                )}
              </div>,
              money(mrpVal),
              money(buyPriceVal),
              money(salesPriceVal),
              money(salesPriceWithGstVal),
              <Badge key="inv" tone={isInvoiceRaised ? "green" : "amber"}>
                {invoiceStatusText}
              </Badge>,
              <Badge key="pay" tone={isPaid ? "green" : isPartPaid ? "amber" : "red"}>
                {paymentStatusText}
              </Badge>,
              <div key="actions" className="flex flex-row items-center gap-1.5 flex-nowrap whitespace-nowrap">
                {paymentButton(d, "SALE")}
                {link("Details", () => docDetail(d, "SALE_FINANCE"))}
                {button("Edit", { kind: "saleFinance", id: d.id })}
                {admin &&
                  d.status === "POSTED" &&
                  paid(s, d.id) === 0 &&
                  button(
                    "Void",
                    { kind: "void", id: d.id, defaults: { documentKind: "SALE" } },
                    true,
                  )}
              </div>,
            ];
          })}
      />
    );
  }

  const stockRows = s.balances.map((b) => {
    const l = s.lots.find((x) => x.id === b.lotId)!,
      p = s.products.find((p) => p.id === l.productId)!;
    const sizeQty = s.balances
      .filter(
        (x) =>
          x.locationId === b.locationId &&
          !x.quarantined &&
          (s.lots.find((lot) => lot.id === x.lotId)?.expiry ?? "") >= today,
      )
      .reduce((a, x) => {
        const lot = s.lots.find((l) => l.id === x.lotId)!;
        return (
          a + (lot.productId === p.id && lot.size === l.size ? x.quantity : 0)
        );
      }, 0);
    const status = b.quarantined
      ? "Quarantined"
      : l.expiry < today
        ? "Expired"
        : b.quantity === 0
          ? "Empty"
          : sizeQty <= p.minimum
            ? "Low stock"
            : "Available";
    return { b, l, p, status };
  });

  function stockTable(limit?: number) {
    const rows = stockRows
      .filter(
        ({ b, l, p, status }) =>
          (!location || b.locationId === location) &&
          (!stockStatus || status === stockStatus) &&
          matches(p.name, l.size, l.batch, name("locations", b.locationId)),
      )
      .slice(0, limit);
    return (
      <Table tabKey={tab}
        heads={[
          "Implant / batch",
          "Size",
          "Location",
          "On hand",
          "Unit cost",
          "Expiry",
          "Status",
          ...(limit ? [] : ["Actions"]),
        ]}
        rows={rows.map(({ b, l, p, status }) => [
          <>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</strong>
            <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {l.batch} · {p.kind.toLowerCase()}
            </small>
          </>,
          l.size,
          name("locations", b.locationId),
          b.quantity,
          money(l.unitCost),
          l.expiry,
          <Badge
            key="badge"
            tone={
              status === "Available"
                ? "green"
                : status === "Low stock"
                  ? "amber"
                  : status === "Empty"
                    ? "blue"
                    : "red"
            }
          >
            {status}
          </Badge>,
          ...(limit
            ? []
            : [
                admin ? (
                  <div className="flex gap-2 items-center flex-wrap">
                    {button("Adjust", {
                      kind: "adjust",
                      id: b.id,
                      defaults: { quantity: String(b.quantity) },
                    })}
                    {button(b.quarantined ? "Release" : "Quarantine", {
                      kind: "quarantine",
                      id: b.id,
                      defaults: { quarantined: String(!b.quarantined) },
                    })}
                  </div>
                ) : (
                  "—"
                ),
              ]),
        ])}
      />
    );
  }

  function content(): ReactNode {
    switch (tab) {
      case "Overview":
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
              <Stat
                label="Stock on hand"
                value={totals.onHand}
                caption={`${totals.inTransit} units in transit`}
              />
              <Stat
                label="Stock value"
                value={money(totals.stockValue)}
                caption="Purchase cost, excluding GST"
              />
              <Stat
                label="Receivables"
                value={money(totals.receivable)}
                caption="Outstanding sales collections"
              />
              <Stat
                label="Payables"
                value={money(totals.payable)}
                caption="Outstanding vendor payments"
              />
            </div>
            {!s.products.length && (
              <div className="relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/15 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-teal-900/30 border border-teal-500/30 dark:border-teal-500/40 p-4 sm:p-5 rounded-2xl shadow-xs mb-6">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Set up your inventory
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Add a vendor, an implant and a receiving location to receive your first purchase.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-center shrink-0 flex-wrap w-full md:w-auto justify-end pt-1 md:pt-0">
                  {button("Add vendor", { kind: "vendor" })}
                  {button("Add implant", { kind: "product" })}
                  {button("Add location", { kind: "location" })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                <div className="flex justify-between items-center gap-4 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Stock at a glance</h2>
                  <div className="flex items-center gap-3">
                    {link("Transfer stock & kits", () => navigate("Transfers & kits"))}
                    {link("View all", () => navigate("Stock"))}
                  </div>
                </div>
                {stockTable(6)}
              </section>
              <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center gap-4 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Stock by location</h2>
                  <MapPin size={18} className="text-slate-400" />
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {s.locations
                    .filter((l) => !l.archived)
                    .map((l) => {
                      const q = s.balances
                        .filter((b) => b.locationId === l.id)
                        .reduce((a, b) => a + b.quantity, 0);
                      const pct = Math.min(100, Math.round((q / Math.max(1, totals.onHand)) * 100));
                      return (
                        <div className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors" key={l.id}>
                          <div className="flex justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                            <span>{l.name}</span>
                            <b>{q}</b>
                          </div>
                          <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            {l.locationType} · {l.address}
                          </small>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  {!s.locations.length && (
                    <p className="text-center py-8 text-slate-400 text-xs">No locations yet.</p>
                  )}
                </div>
              </section>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <section className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center gap-4 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent activity</h2>
                  {link("Full activity log", () => navigate("Activity log"))}
                </div>
                <Table tabKey="Activity log"
                  heads={["When", "Action", "Changed by"]}
                  rows={audit
                    .slice(0, 5)
                    .map((a) => [
                      new Date(a.at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      }),
                      auditLabel(a),
                      a.actorName,
                    ])}
                />
              </section>
              <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center gap-4 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Need attention</h2>
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {s.locations
                    .filter((l) => !l.archived)
                    .map((l) => {
                      const locBalances = stockRows.filter((r) => r.b.locationId === l.id);
                      const alerts = locBalances.filter(
                        (r) => r.status === "Low stock" || r.status === "Empty" || r.status === "Expired" || r.status === "Quarantined"
                      );
                      const alertPct = locBalances.length > 0 ? Math.min(100, Math.round((alerts.length / locBalances.length) * 100)) : 0;
                      return (
                        <div className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors" key={l.id}>
                          <div className="flex justify-between gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                            <span>{l.name}</span>
                            <b className={alerts.length > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400"}>
                              {alerts.length > 0 ? `${alerts.length} alert${alerts.length > 1 ? "s" : ""}` : "Healthy"}
                            </b>
                          </div>
                          <small className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
                            {alerts.length > 0
                              ? alerts.map((a) => `${a.p.name} (${a.status})`).join(", ")
                              : `${l.locationType} · Stock levels normal`}
                          </small>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                alerts.length > 0
                                  ? "bg-gradient-to-r from-amber-500 to-rose-500"
                                  : "bg-emerald-500/40"
                              }`}
                              style={{ width: `${alerts.length > 0 ? Math.max(15, alertPct) : 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {!s.locations.length && (
                    <p className="text-center py-8 text-slate-400 text-xs">No locations found.</p>
                  )}
                </div>
              </section>
            </div>
          </>
        );
      case "Stock":
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
              <Stat
                label="Stock on hand"
                value={totals.onHand}
                caption={`${totals.inTransit} units in transit`}
              />
              <Stat
                label="Stock value"
                value={money(totals.stockValue)}
                caption="Purchase cost, excluding GST"
              />
              <Stat
                label="Receivables"
                value={money(totals.receivable)}
                caption="Outstanding sales collections"
              />
              <Stat
                label="Payables"
                value={money(totals.payable)}
                caption="Outstanding vendor payments"
              />
            </div>
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
              <SearchBox query={query} set={setQuery} />
              <select
                aria-label="Location filter"
                className="px-3 py-2 pr-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-no-repeat bg-[right_0.75rem_center]"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">All locations</option>
                {s.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Stock status"
                className="px-3 py-2 pr-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-no-repeat bg-[right_0.75rem_center]"
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "Available",
                  "Low stock",
                  "Quarantined",
                  "Expired",
                  "Empty",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <button
                className="inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
                onClick={() =>
                  downloadCSV("mediend-stock.csv", [
                    [
                      "Implant",
                      "Size",
                      "Batch",
                      "Location",
                      "Units",
                      "Unit cost INR",
                      "Expiry",
                      "Status",
                    ],
                    ...stockRows
                      .filter(
                        ({ b, l, p, status }) =>
                          (!location || b.locationId === location) &&
                          (!stockStatus || status === stockStatus) &&
                          matches(
                            p.name,
                            l.size,
                            l.batch,
                            name("locations", b.locationId),
                          ),
                      )
                      .map(({ b, l, p, status }) => [
                        p.name,
                        l.size,
                        l.batch,
                        name("locations", b.locationId),
                        b.quantity,
                        moneyInput(l.unitCost),
                        l.expiry,
                        status,
                      ]),
                  ])
                }
              >
                <Download size={16} /> Export
              </button>
            </div>
            {stockTable()}
          </section>
        </div>
      );
      case "Purchases":
        return (
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
              <SearchBox query={query} set={setQuery} placeholder="Search document or vendor name…" />
            </div>
            {documentTable("PURCHASE")}
          </section>
        );
      case "Sales":
        return (
          <div className="space-y-4">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex items-center flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
                <SearchBox
                  query={query}
                  set={setQuery}
                  placeholder={`Search ${salesSubTab === "product" ? "Sales Product" : "Sales Finance"} records…`}
                />
                {salesSubTab === "product" && (
                  <select
                    value={circleFilter}
                    onChange={(e) => setCircleFilter(e.target.value)}
                    className="px-3.5 py-2 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[right_1rem_center] cursor-pointer shadow-xs"
                  >
                    <option value="">All Circles</option>
                    {circleOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
                {salesSubTab === "finance" && (
                  <>
                    <select
                      value={invoiceFilter}
                      onChange={(e) => setInvoiceFilter(e.target.value)}
                      className="px-3.5 py-2 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[right_1rem_center] cursor-pointer shadow-xs"
                    >
                      <option value="">All Invoices</option>
                      <option value="Raised">Raised</option>
                      <option value="Pending">Pending</option>
                    </select>
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      className="px-3.5 py-2 pr-9 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-no-repeat bg-[right_1rem_center] cursor-pointer shadow-xs"
                    >
                      <option value="">All Payment Status</option>
                      <option value="Received">Received</option>
                      <option value="Part Paid">Part Paid</option>
                      <option value="Not Received">Not Received</option>
                    </select>
                  </>
                )}
              </div>
              {salesSubTab === "product" ? salesProductTable() : salesFinanceTable()}
            </section>
          </div>
        );
      case "Transfers & kits": {
        const inTransitCount = s.transfers.filter((t) => t.status === "IN_TRANSIT").length;
        const awaitingReceiptCount = s.transfers.filter(
          (t) => t.status === "IN_TRANSIT" && t.kind.toUpperCase().includes("TRANSFER")
        ).length;
        const receivedCount = s.transfers.filter((t) => t.status === "RECEIVED").length;
        const surgeryKitsCount = s.transfers.filter(
          (t) => t.kind.toUpperCase().includes("KIT") || t.caseReference
        ).length;

        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
              <Stat
                label="In transit"
                value={inTransitCount}
                caption="Transfers pending receipt"
              />
              <Stat
                label="Awaiting receipt"
                value={awaitingReceiptCount}
                caption="Inter-location stock in movement"
              />
              <Stat
                label="Received"
                value={receivedCount}
                caption="Completed stock movements"
              />
              <Stat
                label="Surgery kits"
                value={surgeryKitsCount}
                caption="Case-referenced & kit dispatches"
              />
            </div>
            <div className="flex items-start gap-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 p-4 rounded-xl text-blue-900 dark:text-blue-200 text-xs leading-relaxed shadow-xs">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-blue-950 dark:text-blue-100 mb-0.5">Transfer & Kit Policy Note</strong>
                <span>
                  Sending a kit is not a sale. Confirm receipt, sell only the implants used, and return unused stock when needed. Delivery expenses are recorded separately.
                </span>
              </div>
            </div>
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <Table tabKey={tab}
                heads={[
                  "Transfer",
                  "Route",
                  "Implants",
                  "Units",
                  "Case / type",
                  "Courier & fee",
                  "Status",
                  "Actions",
                ]}
                rows={s.transfers
                  .slice()
                  .reverse()
                  .map((t) => [
                    <div key="transfer">
                      <strong className="font-semibold text-slate-900 dark:text-slate-100">{short(t.id)}</strong>
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{t.date}</small>
                    </div>,
                    <div key="route">
                      {name("locations", t.fromId)}
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">→ {name("locations", t.toId)}</small>
                    </div>,
                    <div key="implants" className="space-y-0.5 max-w-[220px]">
                      {t.lines.map((l, i) => {
                        const lot = s.lots.find((x) => x.id === l.lotId);
                        const prod = lot ? s.products.find((p) => p.id === lot.productId) : s.products.find((p) => p.id === l.lotId);
                        const prodName = prod?.name || (lot ? name("products", lot.productId) : "Item");
                        const sizeStr = lot?.size ? ` (${lot.size})` : "";
                        return (
                          <div key={i} className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate" title={`${prodName}${sizeStr} × ${l.quantity}`}>
                            {prodName}{sizeStr} <span className="text-slate-500 font-semibold">× {l.quantity}</span>
                          </div>
                        );
                      })}
                    </div>,
                    t.lines.reduce((a, l) => a + l.quantity, 0),
                    <div key="case">
                      {t.caseReference || "—"}
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{t.kind.replaceAll("_", " ")}</small>
                    </div>,
                    (() => {
                      const del = s.deliveries.find((d) => d.transferId === t.id && !d.voided);
                      if (!del) return <span key="del" className="text-slate-400 dark:text-slate-500 text-xs">—</span>;
                      return (
                        <div key="del">
                          <strong className="font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                            {del.carrier || "Porter / Courier"}
                          </strong>
                          <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            {del.fee > 0 ? money(del.fee) : "No fee"}
                          </small>
                        </div>
                      );
                    })(),
                    <Badge
                      key="status"
                      tone={
                        t.status === "IN_TRANSIT"
                          ? "amber"
                          : t.status === "CANCELLED"
                            ? "red"
                            : "green"
                      }
                    >
                      {t.status.replaceAll("_", " ")}
                    </Badge>,
                    <div key="actions" className="flex gap-2 items-center flex-wrap">
                      {link("Details", () => transferDetail(t.id))}
                      {t.status === "IN_TRANSIT" ? (
                        <>
                          {button("Receive", { kind: "receive", id: t.id })}
                          {admin &&
                            button(
                              "Cancel",
                              { kind: "cancel", id: t.id },
                              true,
                            )}
                        </>
                      ) : t.status === "RECEIVED" ? (
                        <>
                          {button("Record usage", {
                            kind: "sale",
                            defaults: {
                              locationId: t.toId,
                              caseReference: t.caseReference,
                              billedTo: name("locations", t.toId),
                              handledBy: snapshot!.actor.name,
                            },
                          })}
                          {button("Return unused", {
                            kind: "transfer",
                            defaults: {
                              fromId: t.toId,
                              toId: t.fromId,
                              caseReference: t.caseReference,
                              kind: "UNUSED_RETURN",
                            },
                          })}
                        </>
                      ) : null}
                    </div>,
                  ])}
              />
            </section>
          </div>
        );
      }
      case "Payments": {
        const filteredPayments = s.payments.filter(matchesDateRange);
        const collectedAmount = filteredPayments
          .filter((p) => p.documentKind === "SALE")
          .reduce((acc, p) => acc + p.amount, 0);

        const paidToVendorsAmount = filteredPayments
          .filter((p) => p.documentKind === "PURCHASE")
          .reduce((acc, p) => acc + p.amount, 0);

        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
              <Stat
                label="To collect"
                value={money(totals.receivable)}
                caption="Unpaid sale balances"
              />
              <Stat
                label="Collected from sales"
                value={money(collectedAmount)}
                caption="Total customer payments received"
              />
              <Stat
                label="To pay"
                value={money(totals.payable)}
                caption="Unpaid purchase balances"
              />
              <Stat
                label="Paid to vendors"
                value={money(paidToVendorsAmount)}
                caption="Total vendor payments settled"
              />
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
              {(
                [
                  ["SALE", "Receivables"],
                  ["PURCHASE", "Payables"],
                  ["HISTORY", "Payment history"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    paymentView === v
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                  onClick={() => setPaymentView(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {paymentView === "HISTORY" ? (
                <Table tabKey={tab}
                  heads={[
                    "Date",
                    "Direction",
                    "Document",
                    "Amount",
                    "Method",
                    "Handled by",
                    "Reference",
                    "Proof",
                  ]}
                  rows={filteredPayments
                    .slice()
                    .reverse()
                    .map((p) => [
                      p.date,
                      p.documentKind === "SALE" ? "Collected" : "Paid",
                      short(p.documentId),
                      money(p.amount),
                      p.method.replaceAll("_", " "),
                      p.handledBy,
                      p.reference || "—",
                      attachment(p.proofId),
                    ])}
                />
              ) : (
                documentTable(paymentView, true)
              )}
            </section>
          </div>
        );
      }
      case "Implant P&L": {
        const r = profitReport(s, { from, to, productId: productFilter });
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
              <Stat
                label="Selling value"
                value={money(r.revenue)}
                caption="Sales before GST"
              />
              <Stat
                label="Cost of sold implants"
                value={money(r.cost)}
                caption="Original purchase cost before GST"
              />
              <Stat
                label="Implant profit / loss"
                value={
                  <span className={r.profit < 0 ? "text-red-500 font-bold" : "text-emerald-500 font-bold"}>
                    {money(r.profit)}
                  </span>
                }
                caption="Sales − cost of sold units"
              />
              <Stat
                label="Profit margin"
                value={r.margin === null ? "—" : `${r.margin.toFixed(2)}%`}
                caption="Profit ÷ selling value × 100"
              />
            </div>
            <div className="flex items-start gap-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 p-4 rounded-xl text-blue-900 dark:text-blue-200 text-xs leading-relaxed shadow-xs">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-blue-950 dark:text-blue-100 mb-0.5">Implant P&L Calculation Note</strong>
                <span>
                  Delivery charges are not included in implant P&L. Only posted sales and their original purchase costs are included. Unsold stock is not expensed. Payments do not change profit. This is a pre-GST product margin report; delivery, overheads, stock write-offs and other expenses are separate.
                </span>
              </div>
            </div>
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center gap-4 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Profit by implant, size and batch</h2>
                <button
                  className="inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                  onClick={() =>
                    downloadCSV("mediend-implant-pnl.csv", [
                      ["From", from || "All dates", "To", to || "All dates"],
                      [
                        "Basis",
                        "Sales excluding GST minus purchase cost of sold units; no delivery charges",
                      ],
                      [
                        "Implant",
                        "Size",
                        "Batch",
                        "Sold",
                        "Avg cost per unit INR",
                        "Avg selling price INR",
                        "Sales INR",
                        "Cost INR",
                        "Profit INR",
                        "Margin %",
                      ],
                      ...r.rows.map((x) => [
                        x.name,
                        x.size,
                        x.batch,
                        x.quantity,
                        (x.cost / x.quantity / 100).toFixed(2),
                        (x.revenue / x.quantity / 100).toFixed(2),
                        moneyInput(x.revenue),
                        moneyInput(x.cost),
                        moneyInput(x.profit),
                        x.margin === null ? "" : x.margin.toFixed(2),
                      ]),
                      [
                        "TOTAL",
                        "",
                        "",
                        "",
                        "",
                        "",
                        moneyInput(r.revenue),
                        moneyInput(r.cost),
                        moneyInput(r.profit),
                        r.margin === null ? "" : r.margin.toFixed(2),
                      ],
                    ])
                  }
                >
                  <Download size={16} /> Export P&L
                </button>
              </div>
              <Table tabKey={tab}
                heads={[
                  "Implant / batch",
                  "Size",
                  "Sold",
                  "Avg cost / unit",
                  "Avg sale / unit",
                  "Sales",
                  "Cost",
                  "Profit / loss",
                  "Margin",
                ]}
                rows={r.rows.map((x) => [
                  <>
                    <strong className="font-semibold text-slate-900 dark:text-slate-100">{x.name}</strong>
                    <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{x.batch}</small>
                  </>,
                  x.size,
                  x.quantity,
                  money(x.cost / x.quantity),
                  money(x.revenue / x.quantity),
                  money(x.revenue),
                  money(x.cost),
                  <strong className={x.profit < 0 ? "text-red-500 font-bold" : "text-emerald-500 font-bold"}>
                    {money(x.profit)}
                  </strong>,
                  x.margin === null ? "—" : `${x.margin.toFixed(2)}%`,
                ])}
              />
            </section>
          </div>
        );
      }
      case "Delivery expenses": {
        const r = deliveryReport(s, { from, to });
        return (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Stat
                label="Delivery expenses"
                value={money(r.total)}
                caption="Whole-trip fees; separate from implant P&L"
              />
              <Stat
                label="Trips recorded"
                value={r.rows.length}
                caption="Non-voided delivery records in this period"
              />
            </div>
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center gap-4 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Porter / delivery ledger</h2>
                <button
                  className="inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                  onClick={() =>
                    downloadCSV("mediend-delivery-expenses.csv", [
                      ["Date", "Transfer", "Carrier", "Whole trip expense INR"],
                      ...r.rows.map((d) => [
                        d.date,
                        d.transferId,
                        d.carrier,
                        moneyInput(d.fee),
                      ]),
                      ["TOTAL", "", "", moneyInput(r.total)],
                    ])
                  }
                >
                  <Download size={16} /> Export
                </button>
              </div>
              <Table tabKey={tab}
                heads={[
                  "Date / transfer",
                  "Route",
                  "Carrier",
                  "Fee",
                  "Status",
                  "Actions",
                ]}
                rows={s.deliveries
                  .filter((d) => filteredDate(d.date))
                  .slice()
                  .reverse()
                  .map((d) => {
                    const t = s.transfers.find((t) => t.id === d.transferId)!;
                    return [
                      <>
                        {d.date}
                        <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{short(t.id)}</small>
                      </>,
                      <>
                        {name("locations", t.fromId)}
                        <small className="text-[11px] text-slate-500 dark:text-slate-400 block">→ {name("locations", t.toId)}</small>
                      </>,
                      d.carrier || "—",
                      money(d.fee),
                      <Badge tone={d.voided ? "red" : "blue"}>
                        {d.voided ? "Voided" : "Recorded"}
                      </Badge>,
                      !d.voided ? (
                        <div className="flex gap-2 items-center flex-wrap">
                          {button("Edit fee", { kind: "delivery", id: d.id })}
                          {admin &&
                            button(
                              "Void expense",
                              { kind: "deliveryVoid", id: d.id },
                              true,
                            )}
                        </div>
                      ) : (
                        "—"
                      ),
                    ];
                  })}
              />
            </section>
          </div>
        );
      }
      case "Vendors":
      case "Implant catalog":
      case "Locations": {
        const kind: MasterKind =
            tab === "Vendors"
              ? "vendors"
              : tab === "Locations"
                ? "locations"
                : "products",
          formKind =
            tab === "Vendors"
              ? "vendor"
              : tab === "Locations"
                ? "location"
                : "product";
        const masters = s[kind].filter(
          (x) =>
            (showArchived || !x.archived) && matches(x.name, JSON.stringify(x)),
        );
        return (
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center flex-wrap gap-4 p-4 border-b border-slate-200 dark:border-slate-800">
              <SearchBox query={query} set={setQuery} placeholder={`Search ${tab.toLowerCase()}…`} />
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />{" "}
                Show deleted records
              </label>
            </div>
            <Table tabKey={tab}
              heads={["Name", "Details", "Status", "Actions"]}
              rows={masters.map((r) => [
                <strong className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</strong>,
                <>
                  {"gstin" in r ? (
                    <>
                      {r.phone} · {r.location}
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {r.category} · GSTIN: {r.gstin || "Not entered"}
                      </small>
                    </>
                  ) : "sizes" in r ? (
                    <>
                      {r.sizes.join(" · ")}
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {r.category} · MRP {money(r.mrp)} · {r.kind}
                      </small>
                    </>
                  ) : (
                    <>
                      {r.address}
                      <small className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {r.poc} · {r.phone} · {r.locationType}
                      </small>
                    </>
                  )}
                </>,
                <Badge tone={r.archived ? "red" : "green"}>
                  {r.archived ? "Deleted" : "Active"}
                </Badge>,
                <div className="flex gap-2 items-center flex-wrap">
                  {!r.archived && button("Edit", { kind: formKind, id: r.id })}
                  {admin &&
                    button(
                      r.archived ? "Restore" : "Delete",
                      {
                        kind: "archive",
                        id: r.id,
                        defaults: {
                          masterKind: kind,
                          archived: String(!r.archived),
                        },
                      },
                      true,
                    )}
                </div>,
              ])}
            />
          </section>
        );
      }
      case "Activity log":
        return (
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
              <SearchBox query={query} set={setQuery} />
            </div>
            <Table tabKey={tab}
              heads={[
                "When (IST)",
                "Action",
                "Record",
                "Changed by",
                "Reason",
                "Details",
              ]}
              rows={audit
                .filter((a) =>
                  matches(a.action, a.actorName, a.entityId, a.reason),
                )
                .map((a) => [
                  new Date(a.at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  }),
                  auditLabel(a),
                  short(a.entityId),
                  a.actorName,
                  a.reason || "—",
                  link("View changes", () =>
                    setDetail({
                      title: auditLabel(a),
                      body: (
                        <div className="space-y-4 text-xs">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {a.actorName} ·{" "}
                            {new Date(a.at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })}{" "}
                            IST
                          </p>
                          <p className="text-slate-600 dark:text-slate-400">{a.reason}</p>
                          {a.changes.map((c, i) => (
                            <section key={i} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                                {c.collection} · {short(c.id)}
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <strong className="text-slate-500 dark:text-slate-400 block text-[11px] uppercase">Before</strong>
                                  <pre className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto text-[11px] font-mono">{JSON.stringify(c.before, null, 2)}</pre>
                                </div>
                                <div className="space-y-1">
                                  <strong className="text-slate-500 dark:text-slate-400 block text-[11px] uppercase">After</strong>
                                  <pre className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto text-[11px] font-mono">{JSON.stringify(c.after, null, 2)}</pre>
                                </div>
                              </div>
                            </section>
                          ))}
                        </div>
                      ),
                    }),
                  ),
                ])}
            />
            {moreAudit && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-center bg-slate-50 dark:bg-slate-950">
                <button
                  className="inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all"
                  onClick={async () => {
                    try {
                      const last = audit[audit.length - 1];
                      const response = await fetchJSON(
                        `${apiBase}?audit=1&beforeAt=${encodeURIComponent(last.at)}&beforeId=${last.id}`,
                      );
                      setAudit((old) => [...old, ...response.audit]);
                      setMoreAudit(response.audit.length === 100);
                    } catch (e) {
                      setNotice(
                        e instanceof Error
                          ? e.message
                          : "Unable to load activity.",
                      );
                    }
                  }}
                >
                  Load older activity
                </button>
              </div>
            )}
          </section>
        );
    }
  }

  const mainAction: FormRequest | undefined =
    tab === "Overview" || tab === "Stock" || tab === "Purchases"
      ? { kind: "purchase" }
      : tab === "Sales"
        ? salesSubTab === "finance"
          ? undefined
          : { kind: "saleProduct", defaults: { handledBy: actorName } }
        : tab === "Transfers & kits"
          ? { kind: "transfer" }
          : tab === "Vendors"
            ? { kind: "vendor" }
            : tab === "Implant catalog"
              ? { kind: "product" }
              : tab === "Locations"
                ? { kind: "location" }
                : undefined;

  return (
    <InventoryFilterContext.Provider value={{ filterConfig, tableStatusConfig, activeFilters, setFilter, resetFilters: handleResetFilters }}>
      <div className="w-full">
      <header className="sticky top-0 z-20 bg-background/80 px-4 py-2 backdrop-blur-xl dark:bg-background/80 md:px-6 shrink-0 w-full min-w-0">
        <div className="flex items-center justify-between gap-4 w-full min-w-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">
              {tab === "Overview"
                ? "Inventory overview"
                : tab === "Sales"
                  ? salesSubTab === "finance"
                    ? "Sales Finance"
                    : "Sales Product"
                  : tab}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {tab === "Overview"
                ? "Every implant. Every location. One clear picture."
                : tab === "Sales"
                  ? salesSubTab === "finance"
                    ? "Track and manage pricing, invoices, GST, and payment collections for recorded sales."
                    : "Record surgeries, patient case references, and implants or stock items consumed."
                  : "Manage your implant inventory with a complete record of every change."}
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {(tab === "Purchases" ||
              tab === "Sales" ||
              tab === "Payments" ||
              tab === "Implant P&L" ||
              tab === "Delivery expenses") && (
              <InventoryDateRangePicker
                from={from}
                to={to}
                onChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
              />
            )}
            <Button
              variant="outline"
              className="px-4 py-2 text-xs font-semibold"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin mr-1.5 h-4 w-4" : "mr-1.5 h-4 w-4"} /> Refresh
            </Button>
            {(tab === "Stock" ||
              tab === "Purchases" ||
              tab === "Sales" ||
              tab === "Payments" ||
              tab === "Transfers & kits" ||
              tab === "Delivery expenses" ||
              tab === "Vendors" ||
              tab === "Implant catalog" ||
              tab === "Locations" ||
              tab === "Activity log" ||
              tab === "Implant P&L" ||
              from ||
              to ||
              productFilter ||
              circleFilter ||
              invoiceFilter ||
              paymentFilter ||
              Object.keys(activeFilters).length > 0) && (
              <Button
                variant="outline"
                className="px-4 py-2 text-xs font-semibold"
                onClick={handleResetFilters}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
            )}
            {tab === "Overview" && (
              <Button
                variant="outline"
                className="px-4 py-2 text-xs font-semibold"
                onClick={() => navigate("Transfers & kits")}
              >
                <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transfer Stock
              </Button>
            )}
            {write && mainAction && (
              <Button className="px-4 py-2 text-xs font-semibold" onClick={() => open(mainAction)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {mainAction.kind === "purchase"
                  ? "Receive purchase"
                  : mainAction.kind === "saleProduct"
                    ? "Add Sales Product"
                    : mainAction.kind === "sale"
                      ? "Record sale"
                      : mainAction.kind === "transfer"
                        ? "Transfer stock"
                        : `Add ${mainAction.kind}`}
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="px-4 py-3 md:px-6 md:py-3.5 space-y-3.5">
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3.5 rounded-lg border border-red-200 dark:border-red-800/40 text-xs">
          {error}
        </p>
      )}
      {content()}
      {form && (
        <EntryForm
          key={`${form.kind}-${form.id ?? "new"}`}
          request={form}
          state={s}
          onClose={() => setForm(undefined)}
          onSubmit={save}
        />
      )}{" "}
      {detail && (
        <Detail title={detail.title} onClose={() => setDetail(undefined)}>
          {detail.body}
        </Detail>
      )}
      {notice && (
        <div role="status" className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          {notice}
        </div>
      )}
      </div>
    </div>
    </InventoryFilterContext.Provider>
  );
}

function SearchBox({
  query,
  set,
  placeholder = "Search records…",
}: {
  query: string;
  set: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center relative flex-1 min-w-[200px]">
      <Search size={17} className="absolute left-3 text-slate-400 pointer-events-none" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
        value={query}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}

function auditLabel(a: Audit) {
  if (a.action.endsWith(".save"))
    return `${a.action.split(".")[0]} ${a.changes[0]?.before ? "updated" : "created"}`;
  if (a.action === "master.archive") {
    const after = a.changes[0]?.after as { archived?: boolean } | undefined;
    return `${a.changes[0]?.collection ?? "Master"} ${after?.archived ? "deleted (archived)" : "restored"}`;
  }
  return a.action.replaceAll(".", " ").replaceAll("_", " ");
}

function Detail({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const d = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    d.current?.showModal();
    return () => d.current?.close();
  }, []);
  return (
    <dialog
      ref={d}
      className="fixed inset-0 m-auto z-50 border border-slate-200 dark:border-slate-800 rounded-2xl p-0 w-[800px] max-w-[92vw] text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm overflow-hidden"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-4 p-5 md:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 m-0">{title}</h2>
        <button
          className="inline-flex items-center justify-center border-0 bg-transparent rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={20} />
        </button>
      </header>
      <div className="p-6 max-h-[70vh] overflow-y-auto text-slate-900 dark:text-slate-100">{children}</div>
      <footer className="p-4 md:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2.5">
        <button className="inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all" onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>
  );
}

function downloadCSV(filename: string, rows: Array<Array<unknown>>) {
  const encode = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-[\d.]+$/.test(text)))
      text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(encode).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
