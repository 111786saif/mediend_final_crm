import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { Building2, Calendar, MapPin, Shield, User, Stethoscope, Wallet } from 'lucide-react'
import { getIpdStatusLabel } from '@/lib/ipd-status-labels'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'

/** Minimal lead shape for displaying form data on the card (optional). */
interface LeadForCard {
  patientName?: string | null
  leadRef?: string | null
  age?: number | null
  sex?: string | null
  phoneNumber?: string | null
  alternateNumber?: string | null
  attendantName?: string | null
  circle?: string | null
  treatment?: string | null
  category?: string | null
  quantityGrade?: string | null
  anesthesia?: string | null
  surgeonName?: string | null
  ipdDrName?: string | null
  surgeonType?: string | null
  hospitalName?: string | null
  insuranceName?: string | null
  flowType?: string | null
  modeOfPayment?: string | null
  discount?: number | null
  copay?: number | null
  deduction?: number | null
  settledTotal?: number | null
  billAmount?: number | null
  collectedByMediend?: number | null
  collectedByHospital?: number | null
  remarks?: string | null
  dischargeSheet?: {
    billAmount?: number | null
    cashOrDedPaid?: number | null
    collectedByHospital?: number | null
    collectedByMediend?: number | null
    deductionAmount?: number | null
    discountAmount?: number | null
    settlementPart?: number | null
  } | null
  bd?: { name?: string | null; manager?: { name?: string | null } | null } | null
  kypSubmission?: {
    insuranceType?: string | null
    preAuthData?: {
      sumInsured?: string | null
      copay?: string | null
      capping?: number | string | null
      roomRent?: string | null
      requestedRoomType?: string | null
      tpa?: string | null
    } | null
  } | null
}

interface IPDDetailsCardProps {
  admissionRecord: any
  lead?: LeadForCard | null
}

function fmtCurr(v: number | string | null | undefined) {
  if (v == null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return undefined
  return `₹${n.toLocaleString('en-IN')}`
}

function extractLatestAmountFromRemarks(
  remarks: string | null | undefined,
  key: string,
) {
  if (!remarks) return undefined
  const regex = new RegExp(`${key}:\\s*([\\d.]+)`, 'gi')
  const matches = [...remarks.matchAll(regex)]
  if (matches.length === 0) return undefined
  const value = Number(matches[matches.length - 1][1])
  return Number.isFinite(value) ? value : undefined
}

/** A single labeled value. Renders nothing if there's no value — callers
 * decide whether an all-empty section should be hidden entirely. */
function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  if (value == null || value === '' || value === '-') return null
  return (
    <div className={className}>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</Label>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  )
}

/** A section panel — tinted background, icon header, and its own field grid
 * sized to however many fields it actually has. Renders nothing if every
 * child Field was empty (checked via hasContent). */
function Section({
  icon: Icon,
  iconClassName,
  title,
  hasContent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  title: string
  hasContent: boolean
  children: React.ReactNode
}) {
  if (!hasContent) return null
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconClassName}`} />
        {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  )
}

export function IPDDetailsCard({ admissionRecord, lead }: IPDDetailsCardProps) {
  if (!admissionRecord) return null

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      return format(new Date(dateStr), 'dd MMM yyyy')
    } catch (e) {
      return dateStr
    }
  }

  const tpa = admissionRecord.tpa ?? lead?.kypSubmission?.preAuthData?.tpa ?? null
  const isCash = lead?.flowType === 'CASH'
  const preAuth = lead?.kypSubmission?.preAuthData
  const discharge = lead?.dischargeSheet
  const approvedAmount = (lead?.settledTotal ?? 0) > 0 ? lead?.settledTotal : discharge?.settlementPart
  const finalBillAmount = (lead?.billAmount ?? 0) > 0 ? lead?.billAmount : discharge?.billAmount
  const collectedAmount = extractLatestAmountFromRemarks(lead?.remarks, 'Collected')
  const collectedByMediend = (lead?.collectedByMediend ?? 0) > 0 ? lead?.collectedByMediend : discharge?.collectedByMediend
  const collectedByHospital = (lead?.collectedByHospital ?? 0) > 0 ? lead?.collectedByHospital : discharge?.collectedByHospital
  const discountAmount = (lead?.discount ?? 0) > 0 ? lead?.discount : discharge?.discountAmount
  const deductionAmount = (lead?.deduction ?? 0) > 0 ? lead?.deduction : discharge?.deductionAmount

  const alternateContact =
    lead?.attendantName || lead?.alternateNumber
      ? `${lead?.attendantName ?? '-'} / ${lead?.alternateNumber ?? '-'}`
      : null

  const hasSurgeonDetails = !!(lead?.ipdDrName || lead?.surgeonName || lead?.surgeonType)
  const hasInsuranceDetails =
    !isCash &&
    !!(
      lead?.kypSubmission?.insuranceType ||
      lead?.insuranceName ||
      tpa ||
      preAuth?.sumInsured != null ||
      preAuth?.copay != null ||
      preAuth?.requestedRoomType != null ||
      preAuth?.capping != null ||
      preAuth?.roomRent != null
    )
  const hasCashBilling =
    isCash &&
    !!(
      lead?.modeOfPayment ||
      (approvedAmount ?? 0) > 0 ||
      (finalBillAmount ?? 0) > 0 ||
      (collectedAmount ?? 0) > 0 ||
      (collectedByMediend ?? 0) > 0 ||
      (collectedByHospital ?? 0) > 0 ||
      (discountAmount ?? 0) > 0 ||
      (lead?.copay ?? 0) > 0 ||
      (deductionAmount ?? 0) > 0
    )
  const hasMedicalImplants = !!(
    (isCash || !lead) && tpa
  ) || !!(admissionRecord.implantConsumables || admissionRecord.instrument || admissionRecord.notes) ||
    !!(lead?.bd && (lead.bd.name || lead.bd.manager?.name))

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="bg-linear-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border-b">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <CardTitle>IPD Admission Details</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Patient Information */}
        {lead && (
          <Section icon={User} iconClassName="text-blue-600" title="Patient Information" hasContent>
            <Field label="Patient Name" value={lead.patientName} />
            <Field label="Patient ID / Ref" value={lead.leadRef} />
            <Field label="Age" value={lead.age != null ? lead.age : null} />
            <Field label="Gender" value={lead.sex} />
            <Field label="Alternate Contact" value={alternateContact} />
            <Field label="Circle" value={lead.circle} />
          </Section>
        )}

        {/* Treatment, Procedure & Surgeon — merged into one section since
            both are usually short and were previously split across two
            unevenly-sized columns */}
        {lead && (
          <Section
            icon={Stethoscope}
            iconClassName="text-purple-600"
            title="Treatment & Surgeon"
            hasContent={!!(lead.treatment || lead.quantityGrade || lead.anesthesia || hasSurgeonDetails)}
          >
            <Field label="Treatment" value={lead.treatment} />
            <Field label="Quantity / Grade" value={lead.quantityGrade} />
            <Field label="Anaesthesia" value={lead.anesthesia} />
            <Field label="Surgeon Name" value={lead.ipdDrName ?? lead.surgeonName} />
            <Field label="Surgeon Type" value={lead.surgeonType} />
          </Section>
        )}

        {/* Admission & Surgery */}
        <Section icon={Calendar} iconClassName="text-blue-600" title="Admission & Surgery" hasContent>
          {admissionRecord.ipdStatus && (
            <div className="col-span-2 sm:col-span-3 md:col-span-4 pb-3 mb-1 border-b">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">IPD Status</Label>
              <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {getIpdStatusLabel(admissionRecord.ipdStatus)}
              </p>
              {admissionRecord.ipdStatusUpdatedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Updated {format(new Date(admissionRecord.ipdStatusUpdatedAt), 'dd MMM yyyy, HH:mm')}
                </p>
              )}
            </div>
          )}
          <Field label="Admission Date" value={formatDate(admissionRecord.admissionDate)} />
          <Field label="Admission Time" value={admissionRecord.admissionTime} />
          <Field
            label={admissionRecord.ipdStatus === 'POSTPONED' && admissionRecord.newSurgeryDate ? 'Original surgery date' : 'Surgery Date'}
            value={formatDate(admissionRecord.surgeryDate)}
          />
          <Field label="Surgery Time" value={admissionRecord.surgeryTime} />
          {admissionRecord.ipdStatus === 'POSTPONED' && admissionRecord.newSurgeryDate && (
            <Field
              label="New surgery date"
              value={<span className="text-amber-600 dark:text-amber-400">{formatDate(admissionRecord.newSurgeryDate)}</span>}
            />
          )}
          {admissionRecord.ipdStatus === 'DISCHARGED' && admissionRecord.ipdDischargeDate && (
            <Field label="Discharge date" value={formatDate(admissionRecord.ipdDischargeDate)} />
          )}
          {admissionRecord.ipdStatusReason && (
            <Field
              label="Reason"
              value={<span className="font-normal text-muted-foreground">{admissionRecord.ipdStatusReason}</span>}
              className="col-span-2 sm:col-span-3 md:col-span-4"
            />
          )}
          {admissionRecord.ipdStatusNotes && (
            <Field
              label="Status notes"
              value={<span className="font-normal text-muted-foreground whitespace-pre-line">{admissionRecord.ipdStatusNotes}</span>}
              className="col-span-2 sm:col-span-3 md:col-span-4"
            />
          )}
        </Section>

        {/* Hospital Details */}
        <Section icon={Building2} iconClassName="text-amber-600" title="Hospital Details" hasContent>
          <Field
            label="Admitting Hospital"
            value={admissionRecord.admittingHospital || lead?.hospitalName}
            className="col-span-2 sm:col-span-1"
          />
          <Field
            label="Address"
            value={admissionRecord.hospitalAddress}
            className="col-span-2"
          />
          {admissionRecord.googleMapLocation && (
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Location</Label>
              <div className="mt-1">
                <a
                  href={admissionRecord.googleMapLocation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" /> View on Maps
                </a>
              </div>
            </div>
          )}
        </Section>

        {/* Insurance & Billing (insurance flow) */}
        {lead && !isCash && (
          <Section icon={Shield} iconClassName="text-green-600" title="Insurance & Billing" hasContent={hasInsuranceDetails}>
            <Field
              label="Insurance Type"
              value={lead.kypSubmission?.insuranceType != null ? String(lead.kypSubmission.insuranceType).replace(/_/g, ' ') : null}
            />
            <Field label="Insurance Company" value={lead.insuranceName} />
            <Field label="TPA" value={tpa} />
            <Field label="Sum Insured" value={typeof preAuth?.sumInsured === 'string' ? preAuth.sumInsured : fmtCurr(preAuth?.sumInsured)} />
            <Field label="Co-pay" value={preAuth?.copay != null ? `${preAuth.copay}%` : null} />
            <Field label="Room Type" value={preAuth?.requestedRoomType} />
            <Field
              label="Capping"
              value={
                preAuth?.capping != null && preAuth.capping !== ''
                  ? typeof preAuth.capping === 'string' && !Number.isNaN(Number(preAuth.capping))
                    ? fmtCurr(Number(preAuth.capping))
                    : preAuth.capping
                  : null
              }
            />
            <Field label="Room Rent" value={typeof preAuth?.roomRent === 'string' ? preAuth.roomRent : fmtCurr(preAuth?.roomRent)} />
          </Section>
        )}

        {/* Payment & Billing (cash flow) */}
        {lead && isCash && (
          <Section icon={Wallet} iconClassName="text-green-600" title="Payment & Billing" hasContent={hasCashBilling}>
            <Field label="Mode of Payment" value={normalizeModeOfPaymentLabel(lead.modeOfPayment)} />
            <Field label="Approved / Package" value={fmtCurr(approvedAmount)} />
            <Field label="Final Bill Amount" value={fmtCurr(finalBillAmount)} />
            <Field label="Cash / Deduction Collected" value={fmtCurr(collectedAmount)} />
            <Field label="Collected by Mediend" value={fmtCurr(collectedByMediend)} />
            <Field label="Collected by Hospital" value={fmtCurr(collectedByHospital)} />
            <Field label="Discount" value={fmtCurr(discountAmount)} />
            <Field label="Copay" value={(lead.copay ?? 0) > 0 ? fmtCurr(lead.copay) : null} />
            <Field label="Deduction" value={fmtCurr(deductionAmount)} />
          </Section>
        )}

        {/* Medical, Implants & BD */}
        <Section icon={Shield} iconClassName="text-green-600" title="Medical, Implants & BD" hasContent={hasMedicalImplants}>
          {(isCash || !lead) && <Field label="TPA" value={tpa} />}
          {admissionRecord.implantConsumables && (
            <Field
              label="Implants/Consumables"
              value={<span className="font-normal whitespace-pre-line">{admissionRecord.implantConsumables}</span>}
              className="col-span-2 sm:col-span-3 md:col-span-4"
            />
          )}
          {admissionRecord.instrument && (
            <Field
              label="Instruments"
              value={<span className="font-normal whitespace-pre-line">{admissionRecord.instrument}</span>}
              className="col-span-2 sm:col-span-3 md:col-span-4"
            />
          )}
          {admissionRecord.notes && (
            <Field
              label="Notes"
              value={<span className="font-normal italic text-muted-foreground">{admissionRecord.notes}</span>}
              className="col-span-2 sm:col-span-3 md:col-span-4"
            />
          )}
          {lead?.bd?.name && <Field label="BD Name" value={lead.bd.name} />}
          {lead?.bd?.manager?.name && <Field label="BD Manager" value={lead.bd.manager.name} />}
        </Section>
      </CardContent>
    </Card>
  )
}
