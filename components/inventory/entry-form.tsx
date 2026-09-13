"use client";
import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { InventoryState, Transfer } from "@/lib/inventory/types";
import type { Command } from "@/lib/inventory/commands";
import { commandSchema } from "@/lib/inventory/commands";
import { parseRupees, formatMoney } from "@/lib/inventory/money";
import { todayIndia } from "@/lib/inventory/engine";
import { formFields, initialValues, titles, type FormRequest } from "./forms";

type Line = Record<string, string>;

export function EntryForm({
  request,
  state,
  onClose,
  onSubmit,
}: {
  request: FormRequest;
  state: InventoryState;
  onClose: () => void;
  onSubmit: (command: Command, file?: File) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [values, setValues] = useState(() =>
      initialValues(request, state, todayIndia()),
    ),
    [lines, setLines] = useState<Line[]>(() => {
      const initialLocId = values.locationId || values.fromId;
      const selectedLocation = state.locations.find(
        (loc) => loc.id === initialLocId || loc.name.toLowerCase() === (initialLocId || "").toLowerCase()
      );
      const eligibleInitial = state.balances.filter(
        (b) =>
          (b.locationId === initialLocId || (selectedLocation && b.locationId === selectedLocation.id)) &&
          b.quantity > 0 &&
          !b.quarantined &&
          state.lots.some((l) => l.id === b.lotId)
      );
      const defaultBalanceId = eligibleInitial.length > 0 ? eligibleInitial[0].id : "";

      const activeProducts = state.products.filter((p) => !p.archived);
      const defaultProductId = activeProducts.length > 0 ? activeProducts[0].id : "";
      const defaultSize = activeProducts.length > 0 && activeProducts[0].sizes.length > 0 ? activeProducts[0].sizes[0] : "";
      return [
        { balanceId: defaultBalanceId, productId: defaultProductId, size: defaultSize, quantity: "1", unitCost: "0", unitPrice: "0", expiry: nextYear() },
      ];
    }),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);

  const fields = formFields(request.kind, state),
    isLines = ["purchase", "sale", "transfer"].includes(request.kind),
    purchase = request.kind === "purchase";

  const set = (key: string, value: string) =>
    setValues((old) => {
      const next = { ...old, [key]: value };
      if (key === "gstMode" && value === "WITHOUT_GST") next.tax = "0";
      return next;
    });

  const lineSet = (index: number, key: string, value: string) =>
    setLines((old) =>
      old.map((l, i) =>
        i === index
          ? { ...l, [key]: value, ...(key === "productId" ? { size: "" } : {}) }
          : l,
      ),
    );

  const p = (key: string) => parseRupees(values[key] || "0"),
    n = (key: string) => Number(values[key]);

  const selectedLocId = values.locationId || values.fromId || "";
  const selectedLocation = state.locations.find(
    (loc) =>
      loc.id === selectedLocId ||
      loc.name.toLowerCase() === selectedLocId.toLowerCase()
  );

  const eligible = state.balances.filter((b) => {
    if (b.quantity <= 0 || b.quarantined) return false;
    if (!selectedLocId) return true;

    // Check balance locationId against selectedLocId and selectedLocation.id / name
    const bLoc = state.locations.find((l) => l.id === b.locationId || l.name.toLowerCase() === b.locationId.toLowerCase());
    const matchLoc =
      b.locationId === selectedLocId ||
      b.locationId.toLowerCase() === selectedLocId.toLowerCase() ||
      (selectedLocation && b.locationId === selectedLocation.id) ||
      (bLoc && selectedLocation && bLoc.id === selectedLocation.id) ||
      (bLoc && bLoc.name.toLowerCase() === selectedLocId.toLowerCase());

    return !!matchLoc;
  });

  let subtotal = 0;
  try {
    subtotal = lines.reduce(
      (a, l) =>
        a +
        Number(l.quantity || 0) *
          parseRupees(l[purchase ? "unitCost" : "unitPrice"] || "0"),
      0,
    );
  } catch {
    /* Render an empty estimate until a valid amount is entered. */
  }

  const transfer =
    request.kind === "receive"
      ? state.transfers.find((t) => t.id === request.id)
      : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const common = {
        date: values.date,
        gstMode: values.gstMode,
        documentType: values.documentType,
        reference: values.reference || "",
        tax: p("tax"),
        paidNow: p("paidNow"),
        method: values.method,
        handledBy: values.handledBy,
        proofId: "",
      };
      let command: unknown;
      switch (request.kind) {
        case "vendor":
          command = {
            type: "vendor.save",
            id: request.id,
            name: values.name,
            phone: values.phone,
            location: values.location,
            category: values.category,
            gstin: values.gstin,
          };
          break;
        case "product":
          command = {
            type: "product.save",
            id: request.id,
            name: values.name,
            sizes: values.sizes
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            mrp: p("mrp"),
            category: values.category,
            kind: values.kind,
            minimum: n("minimum"),
          };
          break;
        case "location":
          command = {
            type: "location.save",
            id: request.id,
            name: values.name,
            address: values.address,
            phone: values.phone,
            poc: values.poc,
            locationType: values.locationType,
          };
          break;
        case "purchase":
          command = {
            type: "purchase.post",
            vendorId: values.vendorId,
            locationId: values.locationId,
            ...common,
            lines: lines.map((l) => ({
              productId: l.productId,
              size: l.size,
              batch: l.batch,
              expiry: l.expiry,
              quantity: Number(l.quantity),
              unitCost: parseRupees(l.unitCost),
            })),
          };
          break;
        case "sale":
          command = {
            type: "sale.post",
            locationId: values.locationId,
            billedTo: values.billedTo,
            caseReference: values.caseReference,
            ...common,
            lines: lines.map((l) => ({
              balanceId: l.balanceId,
              quantity: Number(l.quantity),
              unitPrice: parseRupees(l.unitPrice),
            })),
          };
          break;
        case "transfer":
          command = {
            type: "transfer.dispatch",
            fromId: values.fromId,
            toId: values.toId,
            date: values.date,
            caseReference: values.caseReference,
            kind: values.kind,
            notes: values.notes,
            fee: p("fee"),
            carrier: values.carrier,
            lines: lines.map((l) => ({
              balanceId: l.balanceId,
              quantity: Number(l.quantity),
            })),
          };
          break;
        case "receive":
          if (values.acknowledge !== "yes")
            throw Error("Confirm that all units have been received.");
          command = {
            type: "transfer.receive",
            id: request.id,
            date: values.date,
          };
          break;
        case "payment":
          command = {
            type: "payment.post",
            documentId: request.id,
            documentKind: values.documentKind,
            date: values.date,
            amount: p("amount"),
            method: values.method,
            handledBy: values.handledBy,
            reference: values.reference,
            proofId: "",
          };
          break;
        case "delivery":
          command = {
            type: "delivery.save",
            id: request.id,
            fee: p("fee"),
            carrier: values.carrier,
            notes: values.notes,
            reason: values.reason,
          };
          break;
        case "adjust":
          command = {
            type: "stock.adjust",
            balanceId: request.id,
            quantity: n("quantity"),
            reason: values.reason,
          };
          break;
        case "quarantine":
          command = {
            type: "stock.quarantine",
            balanceId: request.id,
            quarantined: values.quarantined === "true",
            reason: values.reason,
          };
          break;
        case "archive":
          command = {
            type: "master.archive",
            kind: values.masterKind,
            id: request.id,
            archived: values.archived === "true",
            reason: values.reason,
          };
          break;
        case "cancel":
          command = {
            type: "transfer.cancel",
            id: request.id,
            reason: values.reason,
          };
          break;
        case "void":
          command = {
            type: "document.void",
            id: request.id,
            documentKind: values.documentKind,
            reason: values.reason,
          };
          break;
        case "deliveryVoid":
          command = {
            type: "delivery.void",
            id: request.id,
            reason: values.reason,
          };
          break;
      }
      const parsed = commandSchema.safeParse(command);
      if (!parsed.success)
        throw Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("\n"),
        );
      await onSubmit(parsed.data, file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="fixed inset-0 m-auto z-50 border border-slate-200 dark:border-slate-800 rounded-2xl p-0 w-[800px] max-w-[92vw] text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm overflow-hidden"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="inventory-form-title"
    >
      <form onSubmit={submit}>
        <header className="flex items-center justify-between gap-4 p-5 md:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div>
            <p className="flex items-center gap-1.5 tracking-wider text-[11px] font-bold uppercase text-teal-700 dark:text-teal-400 mb-1">
              {request.id ? "UPDATE RECORD" : "NEW ENTRY"}
            </p>
            <h2 id="inventory-form-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 m-0">
              {titles[request.kind]}
            </h2>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center border-0 bg-transparent rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            onClick={onClose}
            disabled={busy}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </header>
        <div className="p-6 max-h-[70vh] overflow-y-auto text-slate-900 dark:text-slate-100 space-y-5">
          {request.kind === "sale" && (
            <p className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm">
              Record only the quantity used or sold. Unused implants stay at the
              current location. Original batch cost is saved with this sale.
            </p>
          )}
          {request.kind === "purchase" && (
            <p className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm">
              Receiving adds stock immediately. GST treatment, document type and
              payment method are separate choices.
            </p>
          )}
          {request.kind === "transfer" && (
            <p className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm">
              Stock stays in transit until the receiving location confirms
              receipt. Delivery charges are tracked separately from implant
              profit.
            </p>
          )}
          {request.kind === "archive" && (
            <p className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm">
              {values.archived === "true"
                ? "Delete removes this master from future forms. Historical records remain available and the master can be restored."
                : "Restore makes this master available for new entries again."}
            </p>
          )}
          {request.kind === "void" && (
            <p className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm">
              Only unpaid documents can be voided. Purchases with later stock
              movements cannot be voided. This action reverses stock and
              preserves the original document.
            </p>
          )}
          {request.kind === "cancel" && (
            <p className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm">
              Only cancel after confirming the stock is still with, or returned
              to, the source location. Delivery charges remain recorded; void
              the expense separately only if it was not incurred.
            </p>
          )}
          {transfer && <ReceiptLines transfer={transfer} state={state} />}
          <fieldset disabled={busy} className="border-0 p-0 m-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <label
                key={f.name}
                className={`flex flex-col gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 min-w-0 ${
                  f.type === "textarea" || f.type === "file" ? "sm:col-span-2" : ""
                }`}
              >
                <span>
                  {f.label}
                  {f.required !== false && f.type !== "file" ? " *" : ""}
                </span>
                {f.type === "select" ? (
                  <select
                    required={f.required !== false}
                    value={values[f.name] ?? ""}
                    className="w-full px-3 py-2 pr-8 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-no-repeat bg-[right_0.75rem_center] disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950"
                    onChange={(e) => {
                      const newLocId = e.target.value;
                      set(f.name, newLocId);
                      if (f.name === "locationId" || f.name === "fromId") {
                        const selLoc = state.locations.find(
                          (loc) => loc.id === newLocId || loc.name.toLowerCase() === (newLocId || "").toLowerCase()
                        );
                        const newEligible = state.balances.filter(
                          (b) =>
                            (b.locationId === newLocId || (selLoc && b.locationId === selLoc.id)) &&
                            b.quantity > 0 &&
                            !b.quarantined &&
                            state.lots.some((l) => l.id === b.lotId)
                        );
                        const defaultBalanceId = newEligible.length > 0 ? newEligible[0].id : "";
                        const activeProducts = state.products.filter((p) => !p.archived);
                        const defaultProductId = activeProducts.length > 0 ? activeProducts[0].id : "";
                        const defaultSize = activeProducts.length > 0 && activeProducts[0].sizes.length > 0 ? activeProducts[0].sizes[0] : "";
                        setLines([
                          {
                            balanceId: defaultBalanceId,
                            productId: defaultProductId,
                            size: defaultSize,
                            quantity: "1",
                            unitPrice: "0",
                            unitCost: "0",
                            expiry: nextYear(),
                          },
                        ]);
                      }
                    }}
                  >
                    {!f.options?.length && (
                      <option value="">Create a master first</option>
                    )}
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    required={f.required !== false}
                    value={values[f.name] ?? ""}
                    maxLength={1000}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950"
                    onChange={(e) => set(f.name, e.target.value)}
                    rows={3}
                  />
                ) : f.type === "file" ? (
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    onChange={(e) => {
                      setFile(e.target.files?.[0]);
                    }}
                  />
                ) : (
                  <input
                    required={f.required !== false}
                    type={f.type === "money" ? "text" : (f.type ?? "text")}
                    inputMode={f.name === "phone" ? "tel" : f.type === "money" ? "decimal" : undefined}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.type === "number" ? 1 : undefined}
                    max={f.type === "date" ? todayIndia() : undefined}
                    maxLength={f.name === "phone" ? 10 : f.name === "gstin" ? 15 : 200}
                    placeholder={f.name === "phone" ? "e.g. 9876543210" : f.name === "gstin" ? "e.g. 07AAAAA0000A1Z5" : undefined}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950 uppercase-gstin"
                    value={values[f.name] ?? ""}
                    disabled={
                      f.name === "tax" && values.gstMode === "WITHOUT_GST"
                    }
                    onChange={(e) => {
                      let val = e.target.value;
                      if (f.name === "phone") {
                        val = val.replace(/\D/g, "").slice(0, 10);
                      } else if (f.name === "gstin") {
                        val = val.toUpperCase().slice(0, 15);
                      }
                      set(f.name, val);
                    }}
                  />
                )}{" "}
                {f.hint && <small className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{f.hint}</small>}
              </label>
            ))}
          </fieldset>
          {isLines && (
            <fieldset disabled={busy} className="border-t border-slate-200 dark:border-slate-800 pt-5 mt-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {purchase
                    ? "Implants / instruments to receive"
                    : "Implants to " +
                      (request.kind === "sale" ? "sell" : "send")}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">{lines.length} line(s)</span>
              </div>
              {lines.map((line, i) => {
                const product = state.products.find(
                  (p) => p.id === line.productId,
                );
                return (
                  <div key={i} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <strong className="text-xs text-slate-900 dark:text-slate-100 font-semibold">Item {i + 1}</strong>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center border-0 bg-transparent rounded-md p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((old) =>
                            old.filter((_, index) => index !== i),
                          )
                        }
                        aria-label={`Remove item ${i + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {purchase ? (
                        <>
                          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Implant / instrument
                            <select
                              required
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                              value={line.productId ?? ""}
                              onChange={(e) =>
                                lineSet(i, "productId", e.target.value)
                              }
                            >
                              <option value="">Select item</option>
                              {state.products
                                .filter((p) => !p.archived)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Size
                            <select
                              required
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                              value={line.size ?? ""}
                              onChange={(e) =>
                                lineSet(i, "size", e.target.value)
                              }
                            >
                              <option value="">Select size</option>
                              {product?.sizes.map((size) => (
                                <option key={size}>{size}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Batch / lot
                            <input
                              required
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                              value={line.batch ?? ""}
                              maxLength={200}
                              onChange={(e) =>
                                lineSet(i, "batch", e.target.value)
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Expiry
                            <input
                              required
                              type="date"
                              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                              min={todayIndia()}
                              value={line.expiry ?? ""}
                              onChange={(e) =>
                                lineSet(i, "expiry", e.target.value)
                              }
                            />
                          </label>
                        </>
                      ) : (
                        <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                          Available Implant / Stock Item *
                          <select
                            required
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                            value={line.balanceId ?? ""}
                            onChange={(e) =>
                              lineSet(i, "balanceId", e.target.value)
                            }
                          >
                            <option value="">
                              {eligible.length === 0
                                ? "No available stock items at selected location"
                                : "Select item at this location"}
                            </option>
                            {eligible.map((b) => {
                              const l = state.lots.find((l) => l.id === b.lotId);
                              let prodName = "";
                              let sizeStr = "";
                              let batchStr = "";

                              if (l) {
                                prodName = state.products.find((p) => p.id === l.productId)?.name ?? "";
                                sizeStr = l.size ? ` · Size: ${l.size}` : "";
                                batchStr = l.batch ? ` · Batch: ${l.batch}` : "";
                              }

                              // Fallback product resolution if lot reference is unlinked
                              if (!prodName) {
                                const foundProd = state.products.find(
                                  (p) => p.id === b.lotId || p.id === (b as any).productId
                                );
                                prodName = foundProd?.name || `Implant Item (${b.id.slice(0, 8)})`;
                              }

                              return (
                                <option key={b.id} value={b.id}>
                                  {prodName}{sizeStr}{batchStr} · ({b.quantity} available)
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      )}
                      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                        Quantity
                        <input
                          required
                          type="number"
                          min="1"
                          max="1000000"
                          step="1"
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                          value={line.quantity}
                          onChange={(e) =>
                            lineSet(i, "quantity", e.target.value)
                          }
                        />
                      </label>
                      {request.kind !== "transfer" && (
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                          {purchase
                            ? "Unit purchase cost"
                            : "Unit selling price"}{" "}
                          (₹)
                          <input
                            required
                            inputMode="decimal"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                            value={
                              line[purchase ? "unitCost" : "unitPrice"] ?? "0"
                            }
                            onChange={(e) =>
                              lineSet(
                                i,
                                purchase ? "unitCost" : "unitPrice",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50"
                disabled={lines.length >= 100}
                onClick={() =>
                  setLines((old) => [
                    ...old,
                    {
                      quantity: "1",
                      unitCost: "0",
                      unitPrice: "0",
                      expiry: nextYear(),
                    },
                  ])
                }
              >
                <Plus size={16} /> Add item / size
              </button>
              {request.kind !== "transfer" && (
                <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800/60 rounded-lg text-xs font-medium">
                  <span className="text-slate-600 dark:text-slate-400">Item subtotal (before tax)</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatMoney(subtotal)}</strong>
                </div>
              )}
            </fieldset>
          )}
          {error && (
            <div role="alert" className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3.5 rounded-lg border border-red-200 dark:border-red-800/40 text-xs whitespace-pre-wrap mb-4">
              {error}
            </div>
          )}
        </div>
        <footer className="p-4 md:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button className="inline-flex items-center justify-center gap-2 border border-teal-700 bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50" disabled={busy}>
            {busy
              ? "Saving…"
              : request.kind === "purchase"
                ? "Receive stock"
                : request.kind === "transfer"
                  ? "Dispatch stock"
                  : "Save record"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function nextYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

function ReceiptLines({
  transfer,
  state,
}: {
  transfer: Transfer;
  state: InventoryState;
}) {
  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed mb-4 shadow-sm space-y-2">
      <strong>
        {state.locations.find((l) => l.id === transfer.fromId)?.name} →{" "}
        {state.locations.find((l) => l.id === transfer.toId)?.name}
      </strong>
      <ul className="list-disc list-inside text-xs space-y-1">
        {transfer.lines.map((l, i) => {
          const lot = state.lots.find((x) => x.id === l.lotId)!;
          return (
            <li key={i}>
              {state.products.find((x) => x.id === lot.productId)?.name} ·{" "}
              {lot.size} · {lot.batch} · {l.quantity} units
            </li>
          );
        })}
      </ul>
      <p className="text-xs">
        If quantities differ, leave this transfer in transit for reconciliation.
        This form confirms full receipt only.
      </p>
    </div>
  );
}
