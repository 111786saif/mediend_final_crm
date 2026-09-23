'use client'

import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { formatPlDate, formatPlRupee } from '@/lib/pl/resolve-pl-row'
import { resolveLeadHospitalDoctor, formatLeadAgeSex } from '@/lib/lead-display'
import { getPhoneDisplay } from '@/lib/phone-utils'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { useAuth } from '@/hooks/use-auth'

type DischargeSheet = {
  id: string
  dischargeDate?: string | null
  admissionDate?: string | null
  surgeryDate?: string | null
  status?: string | null
  paymentType?: string | null
  approvedOrCash?: string | null
  managerName?: string | null
  bdmName?: string | null
  // bill breakup
  roomRentAmount?: number | null
  pharmacyAmount?: number | null
  investigationAmount?: number | null
  consumablesAmount?: number | null
  implantsAmount?: number | null
  instrumentsAmount?: number | null
  anesthesiaAmount?: number | null
  otherChargesAmount?: number | null
  otherCharges?: string | null
  packageAmount?: string | null
  staplerCharges?: string | null
  totalFinalBill?: number | null
  // approval & deductions
  finalApprovedAmount?: number | null
  finalAmount?: number | null
  copayAmount?: number | null
  axisTariffDeduction?: number | null
  axisTariffDeductionPaid?: number | null
  discountAmount?: number | null
  waivedOffAmount?: number | null
  tdsAmount?: number | null
  otherDeduction?: number | null
  deductionAmount?: number | null
  cashOrDedPaid?: number | null
  collectedByHospital?: number | null
  collectedByMediend?: number | null
  actualFinalAmount?: number | null
  netSettlementAmount?: number | null
  // documents
  dischargeSummaryUrl?: string | null
  otNotesUrl?: string | null
  finalBillUrl?: string | null
  finalApprovedUrl?: string | null
  deductionReceiptUrl?: string | null
  settlementLetterUrl?: string | null
  // remarks
  remarks?: string | null
  doctorRemarks?: string | null
  costBreakdownRemarks?: string | null
  // finalize meta
  isFinalized?: boolean
  markedAt?: string | null
  finalizedAt?: string | null
}

// Loose structural shape — the patient page passes its full `Lead` type and the
// drawer lazy-fetches /api/leads/{id}; both are read defensively.
type LeadShape = any

interface Props {
  leadId: number
  /** Pre-loaded full lead (e.g. from the patient page query) to skip the panel's own fetch. */
  lead?: LeadShape | null
  /** Show the patient & case section (default true). */
  showPatient?: boolean
}

/**
 * Read-only "patient + discharge info" panel. Renders all patient and discharge
 * data, neatly sectioned, so the same view is shared across the patient page
 * (PL/EA/Insurance/Admin) and the compliance feedback drawer. When `lead` is not
 * supplied it lazy-fetches the full lead from /api/leads/{leadId}.
 */
export function PatientDischargeInfo({ leadId, lead, showPatient = true }: Props) {
  const { user } = useAuth()

  const { data, isLoading } = useQuery<LeadShape>({
    queryKey: ['lead-discharge-info', leadId],
    queryFn: () => apiGet<LeadShape>(`/api/leads/${leadId}`),
    enabled: !lead,
  })

  const full: LeadShape | undefined = lead ?? data
  const ds: DischargeSheet | null | undefined = full?.dischargeSheet

  if (!full && isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!full) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Could not load patient information.
      </div>
    )
  }

  const { hospital, doctor } = resolveLeadHospitalDoctor(full)
  const phone = getPhoneDisplay(full.phoneNumber, canViewPhoneNumber(user))

  const hasBillBreakup = anyAmount(
    ds?.roomRentAmount,
    ds?.pharmacyAmount,
    ds?.investigationAmount,
    ds?.consumablesAmount,
    ds?.implantsAmount,
    ds?.instrumentsAmount,
    ds?.anesthesiaAmount,
    ds?.otherChargesAmount,
    ds?.totalFinalBill,
  ) || !!(ds?.otherCharges || ds?.packageAmount || ds?.staplerCharges)

  const hasApproval = anyAmount(
    ds?.finalApprovedAmount,
    ds?.finalAmount,
    ds?.copayAmount,
    ds?.axisTariffDeduction,
    ds?.axisTariffDeductionPaid,
    ds?.discountAmount,
    ds?.waivedOffAmount,
    ds?.tdsAmount,
    ds?.otherDeduction,
    ds?.deductionAmount,
    ds?.cashOrDedPaid,
    ds?.collectedByHospital,
    ds?.collectedByMediend,
    ds?.actualFinalAmount,
    ds?.netSettlementAmount,
  )

  const hasDocs = !!(
    ds?.dischargeSummaryUrl ||
    ds?.otNotesUrl ||
    ds?.finalBillUrl ||
    ds?.finalApprovedUrl ||
    ds?.deductionReceiptUrl ||
    ds?.settlementLetterUrl
  )

  const hasRemarks = !!(ds?.doctorRemarks || ds?.costBreakdownRemarks || ds?.remarks)

  return (
    <div className="space-y-5 text-sm">
      {showPatient && (
        <Section title="Patient & case">
          <Field label="Patient" value={full.patientName ?? '—'} />
          <Field label="Lead ref" value={full.leadRef ?? '—'} />
          <Field label="Phone" value={phone} />
          <Field label="Age / sex" value={formatLeadAgeSex({ age: full.age, sex: full.sex })} />
          <Field label="Treatment" value={full.treatment ?? '—'} />
          <Field label="Category" value={full.category ?? '—'} />
          <Field label="Hospital" value={hospital ?? '—'} />
          <Field label="Doctor" value={doctor ? `Dr. ${doctor}` : '—'} />
          <Field label="BD" value={full.bd?.name ?? '—'} />
          <Field label="BDM" value={ds?.bdmName ?? '—'} />
          <Field label="Manager" value={ds?.managerName ?? '—'} />
          <Field label="Flow" value={full.flowType ?? '—'} />
        </Section>
      )}

      {ds ? (
        <>
          <Section title="Dates & status">
            <Field label="Admission" value={formatPlDate(toDate(ds.admissionDate))} />
            <Field label="Surgery" value={formatPlDate(toDate(ds.surgeryDate))} />
            <Field label="Discharge" value={formatPlDate(toDate(ds.dischargeDate))} />
            <Field label="Status" value={ds.status ?? (ds.isFinalized ? 'Finalized' : 'Marked')} />
            <Field label="Payment type" value={ds.paymentType ?? ds.approvedOrCash ?? '—'} />
            <Field label="Marked at" value={formatPlDate(toDate(ds.markedAt))} />
            <Field label="Finalized at" value={formatPlDate(toDate(ds.finalizedAt))} />
          </Section>

          {hasBillBreakup && (
            <Section title="Bill breakup">
              <Field label="Room rent" value={formatPlRupee(ds.roomRentAmount ?? null)} />
              <Field label="Pharmacy" value={formatPlRupee(ds.pharmacyAmount ?? null)} />
              <Field label="Investigation" value={formatPlRupee(ds.investigationAmount ?? null)} />
              <Field label="Consumables" value={formatPlRupee(ds.consumablesAmount ?? null)} />
              <Field label="Implants" value={formatPlRupee(ds.implantsAmount ?? null)} />
              <Field label="Instruments" value={formatPlRupee(ds.instrumentsAmount ?? null)} />
              <Field label="Anesthesia" value={formatPlRupee(ds.anesthesiaAmount ?? null)} />
              <Field label="Other charges" value={formatPlRupee(ds.otherChargesAmount ?? null)} />
              {ds.packageAmount ? <Field label="Package" value={ds.packageAmount} /> : null}
              {ds.staplerCharges ? <Field label="Stapler" value={ds.staplerCharges} /> : null}
              <Field label="Total final bill" value={formatPlRupee(ds.totalFinalBill ?? null)} />
            </Section>
          )}

          {hasApproval && (
            <Section title="Approval & deductions">
              <Field label="Final approved" value={formatPlRupee(ds.finalApprovedAmount ?? null)} />
              <Field label="Final amount" value={formatPlRupee(ds.finalAmount ?? null)} />
              <Field label="Co-pay" value={formatPlRupee(ds.copayAmount ?? null)} />
              <Field label="Exxis Tarrif" value={formatPlRupee(ds.axisTariffDeduction ?? null)} />
              <Field label="Exxis Tarrif paid" value={formatPlRupee(ds.axisTariffDeductionPaid ?? null)} />
              <Field label="Discount" value={formatPlRupee(ds.discountAmount ?? null)} />
              <Field label="Waived off" value={formatPlRupee(ds.waivedOffAmount ?? null)} />
              <Field label="TDS" value={formatPlRupee(ds.tdsAmount ?? null)} />
              <Field label="Other deduction" value={formatPlRupee(ds.otherDeduction ?? null)} />
              <Field label="Total deduction" value={formatPlRupee(ds.deductionAmount ?? null)} />
              <Field label="Paid by patient" value={formatPlRupee(ds.cashOrDedPaid ?? null)} />
              <Field label="Collected by hospital" value={formatPlRupee(ds.collectedByHospital ?? null)} />
              <Field label="Collected by MediEND" value={formatPlRupee(ds.collectedByMediend ?? null)} />
              <Field label="Actual final" value={formatPlRupee(ds.actualFinalAmount ?? null)} />
              <Field label="Net settlement" value={formatPlRupee(ds.netSettlementAmount ?? null)} />
            </Section>
          )}

          {hasDocs && (
            <section>
              <h3 className="mb-2 font-medium text-foreground/90">Documents</h3>
              <div className="flex flex-wrap gap-2">
                <DocLink href={ds.dischargeSummaryUrl} label="Discharge summary" />
                <DocLink href={ds.otNotesUrl} label="OT notes" />
                <DocLink href={ds.finalBillUrl} label="Final bill" />
                <DocLink href={ds.finalApprovedUrl} label="Final approved" />
                <DocLink href={ds.deductionReceiptUrl} label="Deduction receipt" />
                <DocLink href={ds.settlementLetterUrl} label="Settlement letter" />
              </div>
            </section>
          )}

          {hasRemarks && (
            <section className="space-y-2">
              <h3 className="font-medium text-foreground/90">Remarks</h3>
              {ds.doctorRemarks ? <RemarkBlock label="Doctor" text={ds.doctorRemarks} /> : null}
              {ds.costBreakdownRemarks ? (
                <RemarkBlock label="Cost breakdown" text={ds.costBreakdownRemarks} />
              ) : null}
              {ds.remarks ? <RemarkBlock label="General" text={ds.remarks} /> : null}
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No discharge sheet on file for this case yet.</p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-medium text-foreground/90">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  )
}

function RemarkBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-2.5">
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
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
      onClick={(e) => e.stopPropagation()}
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

function anyAmount(...vals: (number | null | undefined)[]): boolean {
  return vals.some((v) => typeof v === 'number' && v !== 0)
}
