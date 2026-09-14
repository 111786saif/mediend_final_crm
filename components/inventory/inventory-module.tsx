"use client";
import {
  useCallback,
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
  Box,
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  IndianRupee,
  Info,
  LayoutDashboard,
  MapPin,
  Plus,
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

function Table({
  heads,
  rows,
  empty = "No records found.",
  tabKey,
}: {
  heads: string[];
  rows: ReactNode[][];
  empty?: string;
  tabKey?: Tab;
}) {
  const { hasAccess, permissions } = usePermissions();
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});

  const getColKey = (head: string) => {
    const map: Record<string, string> = {
      // Stock
      Item: "item",
      "Implant / batch": "item",
      Size: "size",
      Location: "location",
      "On hand": "quantity",
      Quantity: "quantity",
      "Unit cost": "unitCost",
      Expiry: "expiry",
      Status: "status",

      // Purchases & Sales shared/specific
      Document: "document",
      Vendor: "vendor",
      "Vendor / billed to": "vendor",
      "Billed to": "billedTo",
      "Case ref no.": "caseRefNo",
      "Items & Location": "itemsLocation",
      "Implant, Batch & Qty": "implantBatchQty",
      "Unit price": "unitPrice",
      "GST / type": "gstType",
      Total: "total",
      Paid: "paid",
      Outstanding: "outstanding",
      "Handled by": "handledBy",
      Actions: "actions",

      // Transfers
      Transfer: "transfer",
      Route: "route",
      Implants: "implants",
      Units: "units",
      "Case / type": "caseType",
      "Courier & fee": "courierFee",
    };
    return map[head] || head.toLowerCase().replace(/[^a-z0-9]/g, "");
  };

  const rbacColumnVisibility = useMemo(() => {
    if (!tabKey) return undefined;
    const tabResKey = TAB_RESOURCE_KEYS[tabKey];
    if (!tabResKey) return undefined;

    const vis: Record<string, boolean> = {};
    heads.forEach((head, idx) => {
      const colKey = getColKey(head);
      const resKey = `${tabResKey}.column.${colKey}`;
      // Check if specific column entity key exists in permissions map
      const hasPermConfigured = permissions && Object.prototype.hasOwnProperty.call(permissions, resKey);
      if (hasPermConfigured) {
        vis[`col_${idx}`] = hasAccess(resKey, "READ");
      } else {
        // If column key is not explicitly registered/configured in permissions, default to visible
        vis[`col_${idx}`] = true;
      }
    });
    return vis;
  }, [heads, tabKey, hasAccess, permissions]);

  // Convert legacy heads + array rows into TanStack ColumnDef schema with ColumnFilter header support
  const columns = useMemo<ColumnDef<ReactNode[]>[]>(() => {
    return heads.map((head, idx) => {
      // Determine filter options for string cells
      const uniqueValues = Array.from(
        new Set(
          rows
            .map((r) => {
              const val = r[idx];
              if (typeof val === "string" || typeof val === "number") return String(val);
              return "";
            })
            .filter((v) => v !== "" && v !== "—")
        )
      );

      return {
        id: `col_${idx}`,
        accessorFn: (row) => row[idx],
        header: () => {
          // If options exist or header is standard, attach ColumnFilter
          if (uniqueValues.length > 0 && uniqueValues.length <= 100) {
            return (
              <ColumnFilter
                options={uniqueValues}
                value={columnFilters[`col_${idx}`]}
                onChange={(val) =>
                  setColumnFilters((prev) => ({ ...prev, [`col_${idx}`]: val }))
                }
                type={uniqueValues.length > 15 ? "search" : "multiSelect"}
                trigger={
                  <span className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:text-teal-600">
                    {head}
                  </span>
                }
              />
            );
          }
          return (
            <span className="text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 font-semibold">
              {head}
            </span>
          );
        },
        cell: ({ row }) => (
          <div className="text-slate-800 dark:text-slate-200">
            {row.original[idx]}
          </div>
        ),
      };
    });
  }, [heads, rows, columnFilters]);

  // Apply column filters on local row arrays
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      return Object.entries(columnFilters).every(([colId, filterVal]) => {
        if (!filterVal || (Array.isArray(filterVal) && filterVal.length === 0)) return true;
        const colIdx = parseInt(colId.replace("col_", ""), 10);
        const cellVal = row[colIdx];
        const cellStr = typeof cellVal === "string" || typeof cellVal === "number" ? String(cellVal).toLowerCase() : "";

        if (Array.isArray(filterVal)) {
          return filterVal.some((fv) => cellStr.includes(String(fv).toLowerCase()));
        }
        if (typeof filterVal === "string") {
          return cellStr.includes(filterVal.toLowerCase());
        }
        return true;
      });
    });
  }, [rows, columnFilters]);

  return (
    <div className="w-full max-w-full overflow-x-auto min-w-0">
      <DataTable
        columns={columns}
        data={filteredRows}
        emptyMessage={empty}
        enablePagination={filteredRows.length > 25}
        initialPageSize={25}
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
    [audit, setAudit] = useState<Audit[]>([]),
    [moreAudit, setMoreAudit] = useState(true);

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
      }
    }
  }, [tabParam]);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Snapshot = await fetchJSON(apiBase);
      setSnapshot(data);
      setAudit(data.audit);
      setMoreAudit(data.audit.length === 100);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetchJSON]);

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

  function docDetail(doc: Purchase | Sale, kind: "PURCHASE" | "SALE") {
    setDetail({
      title: `${kind === "SALE" ? "Sale" : "Purchase"} ${short(doc.id)}`,
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            {Object.entries({
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
            }).map(([k, v]) => (
              <div key={k}>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{k}</small>
                <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">{v}</strong>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">Items</h3>
          <Table
            heads={[
              "Item / batch",
              "Size",
              "Qty",
              "Cost / unit",
              "Sale / unit",
            ]}
            rows={doc.lines.map((l) => [
              <>
                <strong className="font-semibold">{l.productName}</strong>
                <small className="text-[11px] text-slate-500 dark:text-slate-400 block">{l.batch}</small>
              </>,
              l.size,
              l.quantity,
              money(l.unitCost),
              kind === "SALE" && "unitPrice" in l ? money(l.unitPrice) : "—",
            ])}
          />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 pt-2">Payments</h3>
          <Table
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
        onClick={() => {
          setFrom("");
          setTo("");
          setProductFilter("");
        }}
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
                <Table tabKey={tab}
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
      case "Sales":
        return (
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center flex-wrap gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
              <SearchBox query={query} set={setQuery} placeholder="Search document, vendor or billed-to name…" />
            </div>
            {documentTable(tab === "Purchases" ? "PURCHASE" : "SALE")}
          </section>
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
        const collectedAmount = s.payments
          .filter((p) => p.documentKind === "SALE")
          .reduce((acc, p) => acc + p.amount, 0);

        const paidToVendorsAmount = s.payments
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
                  rows={s.payments
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
        ? { kind: "sale", defaults: { handledBy: snapshot.actor.name } }
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
    <div className="w-full">
      <header className="sticky top-0 z-20 bg-background/80 px-4 py-2 backdrop-blur-xl dark:bg-background/80 md:px-6 shrink-0 w-full min-w-0">
        <div className="flex items-center justify-between gap-4 w-full min-w-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl text-foreground">
              {tab === "Overview" ? "Inventory overview" : tab}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {tab === "Overview"
                ? "Every implant. Every location. One clear picture."
                : "Manage your implant inventory with a complete record of every change."}
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {(tab === "Implant P&L" || tab === "Delivery expenses") && (
              <div className="flex items-center gap-2 mr-1">
                <div className="relative flex items-center border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-teal-500">
                  <Calendar size={14} className="text-slate-400 shrink-0 mr-1.5 pointer-events-none" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 select-none">From:</span>
                  <input
                    type="date"
                    aria-label="From date"
                    className="bg-transparent text-slate-900 dark:text-slate-100 text-xs focus:outline-none font-medium cursor-pointer"
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
                </div>
                <span className="text-xs text-slate-400 font-medium">to</span>
                <div className="relative flex items-center border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-teal-500">
                  <Calendar size={14} className="text-slate-400 shrink-0 mr-1.5 pointer-events-none" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 select-none">To:</span>
                  <input
                    type="date"
                    aria-label="To date"
                    className="bg-transparent text-slate-900 dark:text-slate-100 text-xs focus:outline-none font-medium cursor-pointer"
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
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="px-4 py-2 text-xs font-semibold"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin mr-1.5 h-4 w-4" : "mr-1.5 h-4 w-4"} /> Refresh
            </Button>
            {(tab === "Implant P&L" || tab === "Delivery expenses" || from || to || productFilter) && (
              <Button
                variant="outline"
                className="px-4 py-2 text-xs font-semibold"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setProductFilter("");
                }}
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
