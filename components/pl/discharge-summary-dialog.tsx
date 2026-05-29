'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { apiGet } from '@/lib/api-client'
import { formatPlDate, formatPlRupee } from '@/lib/pl/resolve-pl-row'

type DischargeSheet = {
  id: string
  dischargeDate?: string | null
  admissionDate?: string | null
  surgeryDate?: string | null
  status?: string | null
  paymentType?: string | null
  totalFinalBill?: number | null
  finalApprovedAmount?: number | null
  deductionAmount?: number | null
  cashOrDedPaid?: number | null
  waivedOffAmount?: number | null
  doctorName?: string | null
  hospitalName?: string | null
  dischargeSummaryUrl?: string | null
  finalBillUrl?: string | null
  settlementLetterUrl?: string | null
  otNotesUrl?: string | null
  roomRentAmount?: number | null
  pharmacyAmount?: number | null
  investigationAmount?: number | null
  consumablesAmount?: number | null
  implantsAmount?: number | null
  instrumentsAmount?: number | null
  remarks?: string | null
  doctorRemarks?: string | null
  costBreakdownRemarks?: string | null
  isFinalized?: boolean
  markedAt?: string | null
  finalizedAt?: string | null
}

type LeadShape = {
  id: string
  leadRef?: string
  patientName?: string
  dischargeSheet?: DischargeSheet | null
}

interface Props {
  leadId: string
  /** Pre-loaded discharge sheet from a parent query, to skip the dialog's own fetch when present. */
  preloaded?: DischargeSheet | null
  /** Pass a custom trigger; defaults to a small outline button. */
  trigger?: React.ReactNode
  /** Hide entirely when there's no discharge sheet (default: true). */
  hideWhenEmpty?: boolean
  /** When true, render the trigger disabled instead of hiding it. */
  disableWhenEmpty?: boolean
}

export function DischargeSummaryDialog({
  leadId,
  preloaded,
  trigger,
  hideWhenEmpty = true,
  disableWhenEmpty = false,
}: Props) {
  const [open, setOpen] = useState(false)

  // Only fetch when dialog opens and we don't already have data.
  const { data, isLoading } = useQuery<LeadShape>({
    queryKey: ['lead-discharge', leadId],
    queryFn: () => apiGet<LeadShape>(`/api/leads/${leadId}`),
    enabled: open && !preloaded,
  })

  const ds: DischargeSheet | null | undefined = preloaded ?? data?.dischargeSheet

  if (hideWhenEmpty && !preloaded && !disableWhenEmpty) {
    // Render the trigger; we'll only show empty-state inside the dialog if user opens it.
  }

  const defaultTrigger = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={(e) => e.stopPropagation()}
      className="h-7 px-2 text-xs"
    >
      <FileText className="h-3.5 w-3.5 mr-1" />
      Discharge Summary
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Discharge Summary</DialogTitle>
          <DialogDescription>
            Read-only snapshot of the discharge sheet. To edit, open the discharge form.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !ds ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !ds ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No discharge sheet on file for this case yet.
          </div>
        ) : (
          <div className="space-y-5 pt-2 text-sm">
            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Status" value={ds.status ?? (ds.isFinalized ? 'Finalized' : 'Marked')} />
              <Field label="Payment type" value={ds.paymentType ?? '—'} />
              <Field label="Doctor" value={ds.doctorName ?? '—'} />
              <Field label="Hospital" value={ds.hospitalName ?? '—'} />
              <Field label="Admission" value={formatPlDate(toDate(ds.admissionDate))} />
              <Field label="Surgery" value={formatPlDate(toDate(ds.surgeryDate))} />
              <Field label="Discharge" value={formatPlDate(toDate(ds.dischargeDate))} />
              <Field label="Marked at" value={formatPlDate(toDate(ds.markedAt))} />
              <Field label="Finalized at" value={formatPlDate(toDate(ds.finalizedAt))} />
            </section>

            <section>
              <h3 className="font-medium text-foreground/90 mb-2">Bill & deductions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Total bill" value={formatPlRupee(ds.totalFinalBill ?? null)} />
                <Field label="Approved" value={formatPlRupee(ds.finalApprovedAmount ?? null)} />
                <Field label="Total deduction" value={formatPlRupee(ds.deductionAmount ?? null)} />
                <Field
                  label="Paid by patient"
                  value={formatPlRupee(ds.cashOrDedPaid ?? null)}
                />
                <Field
                  label="Waived off"
                  value={formatPlRupee(
                    ds.waivedOffAmount ??
                      Math.max((ds.deductionAmount ?? 0) - (ds.cashOrDedPaid ?? 0), 0),
                  )}
                />
              </div>
            </section>

            {(ds.roomRentAmount ||
              ds.pharmacyAmount ||
              ds.investigationAmount ||
              ds.consumablesAmount ||
              ds.implantsAmount ||
              ds.instrumentsAmount) ? (
              <section>
                <h3 className="font-medium text-foreground/90 mb-2">Bill breakup</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Room rent" value={formatPlRupee(ds.roomRentAmount ?? null)} />
                  <Field label="Pharmacy" value={formatPlRupee(ds.pharmacyAmount ?? null)} />
                  <Field label="Investigation" value={formatPlRupee(ds.investigationAmount ?? null)} />
                  <Field label="Consumables" value={formatPlRupee(ds.consumablesAmount ?? null)} />
                  <Field label="Implants" value={formatPlRupee(ds.implantsAmount ?? null)} />
                  <Field label="Instruments" value={formatPlRupee(ds.instrumentsAmount ?? null)} />
                </div>
              </section>
            ) : null}

            {(ds.dischargeSummaryUrl || ds.finalBillUrl || ds.settlementLetterUrl || ds.otNotesUrl) ? (
              <section>
                <h3 className="font-medium text-foreground/90 mb-2">Documents</h3>
                <div className="flex flex-wrap gap-2">
                  <DocLink href={ds.dischargeSummaryUrl} label="Discharge summary" />
                  <DocLink href={ds.finalBillUrl} label="Final bill" />
                  <DocLink href={ds.settlementLetterUrl} label="Settlement letter" />
                  <DocLink href={ds.otNotesUrl} label="OT notes" />
                </div>
              </section>
            ) : null}

            {(ds.doctorRemarks || ds.costBreakdownRemarks || ds.remarks) ? (
              <section className="space-y-2">
                <h3 className="font-medium text-foreground/90">Remarks</h3>
                {ds.doctorRemarks ? <RemarkBlock label="Doctor" text={ds.doctorRemarks} /> : null}
                {ds.costBreakdownRemarks ? (
                  <RemarkBlock label="Cost breakdown" text={ds.costBreakdownRemarks} />
                ) : null}
                {ds.remarks ? <RemarkBlock label="General" text={ds.remarks} /> : null}
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function RemarkBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-2.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{text}</div>
    </div>
  )
}

function DocLink({ href, label }: { href?: string | null; label: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  )
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
