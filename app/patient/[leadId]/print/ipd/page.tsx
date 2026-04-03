'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { PrinterIcon, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Lead {
  id: string
  patientName: string
  leadRef: string
  age?: number | null
  sex?: string | null
  dateOfBirth?: string | Date | null
  profession?: string | null
  phoneNumber?: string | null
  hospitalName: string
  treatment?: string | null
  ipdDrName?: string | null
  surgeonName?: string | null
  surgeonType?: string | null
  circle?: string | null
  category?: string | null
  quantityGrade?: string | null
  anesthesia?: string | null
  insuranceName?: string | null
  insuranceType?: string | null
  tpa?: string | null
  sumInsured?: string | number | null
  copay?: string | number | null
  capping?: string | number | null
  roomRent?: string | number | null
  modeOfPayment?: string | null
  billAmount?: number | string | null
  flowType?: string | null
  pipelineStage?: string | null
  caseStage?: string | null
  attendantName?: string | null
  attendantContactNo?: string | null
  instrument?: string | null
  consumables?: string | null
  admissionRecord?: {
    id: string
    admissionDate?: string
    admissionTime?: string
    surgeryDate?: string
    surgeryTime?: string
    admittingHospital?: string
    hospitalAddress?: string
    googleMapLocation?: string
    tpa?: string | null
    instrument?: string
    implantConsumables?: string
    notes?: string
    ipdStatus?: string
    ipdStatusReason?: string
    ipdStatusNotes?: string
    ipdStatusUpdatedAt?: string
    newSurgeryDate?: string
    ipdDischargeDate?: string
  } | null
  insuranceInitiateForm?: {
    id: string
    totalBillAmount?: number | null
    discount?: number | null
    otherReductions?: number | null
    copay?: number | null
    copayBuffer?: number | null
    deductible?: number | null
    exceedsPolicyLimit?: string | null
    policyDeductibleAmount?: number | null
    totalAuthorizedAmount?: number | null
    amountToBePaidByInsurance?: number | null
    roomCategory?: string | null
  } | null
  kypSubmission?: {
    aadharFileUrl?: string | null
    aadharFiles?: unknown
    panFileUrl?: string | null
    panFiles?: unknown
    insuranceCardFileUrl?: string | null
    prescriptionFileUrl?: string | null
    diseasePhotos?: unknown
    otherFiles?: unknown
    location?: string | null
    area?: string | null
    insuranceType?: string | null
    disease?: string | null
    preAuthData?: {
      diseaseImages?: unknown
      investigationFileUrls?: unknown
      prescriptionFiles?: unknown
      tpa?: string | null
      sumInsured?: string | null
      balanceInsured?: string | null
      copay?: string | null
      capping?: string | number | null
      roomRent?: string | null
      insurance?: string | null
      insuranceType?: string | null
      approvalStatus?: string | null
      approvedAmount?: string | number | null
      requestedHospitalName?: string | null
      requestedRoomType?: string | null
      expectedAdmissionDate?: string | null
      expectedSurgeryDate?: string | null
      diseaseDescription?: string | null
      suggestedHospitals?: Array<{
        id: string
        hospitalName: string
        tentativeBill?: number | null
        suggestedDoctor?: string | null
      }> | null
    } | null
  } | null
}

const EM_DASH = '—'

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return EM_DASH
  try { return format(new Date(dateStr), 'dd MMM yyyy') } catch { return String(dateStr) }
}

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return EM_DASH
  const s = typeof v === 'number' ? String(v) : String(v).trim()
  return s.length ? s : EM_DASH
}

function formatMoneyLike(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return EM_DASH
  if (typeof v === 'number' && !Number.isNaN(v)) return `₹${v.toLocaleString('en-IN')}`
  const s = String(v).trim()
  if (!s) return EM_DASH
  const n = Number(s.replace(/[₹,\s]/g, ''))
  if (!Number.isNaN(n) && s.match(/^[\d.,\s₹-]+$/)) return `₹${n.toLocaleString('en-IN')}`
  return s
}

function formatCopay(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return EM_DASH
  const s = String(v).trim()
  if (!s) return EM_DASH
  if (s.includes('%')) return s
  const n = Number(s)
  if (!Number.isNaN(n)) return `${n}%`
  return s
}

function humanizeEnum(v: string | null | undefined): string {
  if (!v?.trim()) return EM_DASH
  return v.replace(/_/g, ' ')
}


/* ─── Design components ─────────────────────────────────────────────────── */

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Patient: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  'Clinical details': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
  Insurance: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  'Pre-authorization': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  'Hospital details': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Instruments, implants & consumables': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  Documents: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
}
const DEFAULT_COLOR = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500' }

function InfoSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  const c = SECTION_COLORS[title] ?? DEFAULT_COLOR
  return (
    <section className={cn('print:break-inside-avoid rounded-xl border overflow-hidden', c.border, className)}>
      <div className={cn('flex items-center gap-2 px-4 py-2.5', c.bg)}>
        <span className={cn('h-2 w-2 rounded-full shrink-0', c.dot)} />
        <span className={cn('text-[10px] font-bold tracking-[0.15em] uppercase', c.text)}>
          {title}
        </span>
      </div>
      <div className="px-4 py-4 bg-white">
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  const isEmpty = typeof value === 'string' && (value === EM_DASH || !value.trim())
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1 leading-none">
        {label}
      </p>
      <div
        className={cn(
          'text-[13px] leading-snug break-words',
          isEmpty ? 'text-slate-300 italic' : 'text-slate-900 font-semibold'
        )}
      >
        {value ?? EM_DASH}
      </div>
    </div>
  )
}

/* ─── Auth helpers ──────────────────────────────────────────────────────── */

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-slate-200 bg-white p-8 text-center rounded-xl shadow-sm">
        <p className="text-slate-500 text-sm">You do not have permission to view this page.</p>
        <Button variant="outline" className="mt-6 w-full" onClick={onBack}>Go Back</Button>
      </div>
    </div>
  )
}

function NotFound({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-slate-200 bg-white p-8 text-center rounded-xl shadow-sm">
        <p className="text-slate-500 text-sm">{message}</p>
        <Button variant="outline" className="mt-6 w-full" onClick={onBack}>Go Back</Button>
      </div>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function IPDPrintPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const leadId = params.leadId as string

  const isAuthorized = user && ['BD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role)

  const { data: lead, isLoading } = useQuery<Lead | null>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId && !!isAuthorized,
  })

  if (!isAuthorized) return <AccessDenied onBack={() => router.back()} />

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-400 animate-pulse">Loading patient summary…</p>
      </div>
    )
  }

  if (!lead) return <NotFound message="Patient record not found." onBack={() => router.back()} />

  const rec = lead.admissionRecord
  const kyp = lead.kypSubmission
  const pre = kyp?.preAuthData
  /* implant/consumables parsing */
  const implantConsumablesStr = rec?.implantConsumables || ''
  const implantLine = implantConsumablesStr.split('\n').find((l) =>
    l.trim().toLowerCase().startsWith('implants:')
  )
  const consumablesLine = implantConsumablesStr.split('\n').find((l) =>
    l.trim().toLowerCase().startsWith('consumables:')
  )
  const restImplantBlock = implantConsumablesStr
    .split('\n')
    .filter(
      (l) =>
        !l.trim().toLowerCase().startsWith('implants:') &&
        !l.trim().toLowerCase().startsWith('consumables:')
    )
    .join('\n')
    .trim()

  /* derived display values */
  const insuranceNameDisplay = pre?.insurance?.trim() || lead.insuranceName?.trim() || EM_DASH
  const insuranceTypeDisplay = display(pre?.insuranceType || kyp?.insuranceType || lead.insuranceType)
  const tpaDisplay = display(pre?.tpa || rec?.tpa || lead.tpa)
  const sumInsuredDisplay = formatMoneyLike(pre?.sumInsured ?? lead.sumInsured)
  const balanceInsuredDisplay = formatMoneyLike(pre?.balanceInsured)
  const copayDisplay = formatCopay(pre?.copay ?? lead.copay)
  const cappingDisplay = (() => {
    const c = pre?.capping ?? lead.capping
    if (c === null || c === undefined || c === '') return EM_DASH
    if (typeof c === 'number' && !Number.isNaN(c)) return `₹${c.toLocaleString('en-IN')}`
    const s = String(c).trim()
    const n = Number(s.replace(/[₹,\s]/g, ''))
    if (!Number.isNaN(n) && /^[\d.,\s₹-]+$/.test(s)) return `₹${n.toLocaleString('en-IN')}`
    return s || EM_DASH
  })()
  const roomRentDisplay = formatMoneyLike(pre?.roomRent ?? lead.roomRent)
  const surgeonDisplay = display(lead.ipdDrName || lead.surgeonName)
  const initForm = lead.insuranceInitiateForm
  const tentativeBillFromHospital = (() => {
    const hospitals = pre?.suggestedHospitals
    const requested = pre?.requestedHospitalName?.trim()
    if (!hospitals?.length || !requested) return null
    const match = hospitals.find(h => h.hospitalName?.trim() === requested)
    return match?.tentativeBill ?? null
  })()
  const billAmountDisplay = (() => {
    // Prefer: initiate form totalBillAmount > approved amount > tentative bill > lead.billAmount
    if (initForm?.totalBillAmount && initForm.totalBillAmount > 0) return formatMoneyLike(initForm.totalBillAmount)
    if (pre?.approvedAmount && Number(pre.approvedAmount) > 0) return formatMoneyLike(pre.approvedAmount)
    if (tentativeBillFromHospital && tentativeBillFromHospital > 0) return formatMoneyLike(tentativeBillFromHospital)
    if (lead.billAmount && Number(lead.billAmount) > 0) return formatMoneyLike(lead.billAmount)
    return EM_DASH
  })()

  /* surgery date: show newSurgeryDate if it exists (rescheduled), else surgeryDate */
  const isRescheduled =
    !!rec?.newSurgeryDate &&
    !!rec?.surgeryDate &&
    rec.newSurgeryDate !== rec.surgeryDate
  const effectiveSurgeryDate = isRescheduled
    ? formatDate(rec?.newSurgeryDate)
    : formatDate(rec?.surgeryDate)

  const showInstrumentsSection =
    !!(rec?.instrument?.trim()) ||
    !!(lead.instrument?.trim()) ||
    !!implantLine ||
    !!consumablesLine ||
    !!restImplantBlock

  const showHospitalDetails =
    (rec?.admittingHospital || lead.hospitalName) || (rec && (rec.hospitalAddress || rec.googleMapLocation || rec.tpa || rec.notes))

  const printedAt = format(new Date(), 'dd MMM yyyy, HH:mm')
  const pdfTitle = `${lead.patientName} - ${format(new Date(), 'dd MMM yyyy')}`

  // Set document title for PDF filename
  useEffect(() => {
    const prev = document.title
    document.title = pdfTitle
    return () => { document.title = prev }
  }, [pdfTitle])

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* ── Screen toolbar ── */}
      <div className="print:hidden sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 shadow-md">
        <div>
          <p className="text-sm font-bold text-white">Patient Case Summary</p>
          <p className="text-xs text-blue-200">{lead.patientName} &middot; {lead.leadRef}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => router.back()}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
          </Button>
          <Button size="sm" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold" onClick={() => window.print()}>
            <PrinterIcon className="mr-1.5 h-3.5 w-3.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 print:px-0 print:py-0 print:max-w-none">

        {/* ── Print-only top header ── */}
        <div className="hidden print:flex items-center justify-between mb-5 pb-3 border-b-2 border-blue-200">
          <div>
            <p className="text-[10px] text-slate-400">Patient Case Summary &middot; {printedAt}</p>
          </div>
          <span className="font-mono text-xs font-bold text-white bg-blue-600 rounded-md px-3 py-1">
            {lead.leadRef}
          </span>
        </div>

        {/* ── Hero identity card ── */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-md print:rounded-none print:shadow-none print:border-0 print:border-b print:border-slate-300 print:mb-6">
          {/* colour accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-purple-500 to-teal-400" />

          <div className="p-6 print:p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              {/* left: identity */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 print:hidden">
                  Patient case summary
                </p>
                <h1 className="mt-1 text-[22px] font-bold text-slate-900 leading-tight print:mt-0">
                  {lead.patientName}
                </h1>
                {(kyp?.disease || lead.treatment) && (
                  <p className="mt-0.5 text-sm font-medium text-blue-600 print:text-slate-500">
                    {display(kyp?.disease || lead.treatment)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {lead.age != null && (
                    <span className="text-xs font-semibold text-slate-600">{lead.age} yrs</span>
                  )}
                  {lead.sex && <span className="text-xs text-slate-500">{lead.sex}</span>}
                  {lead.dateOfBirth && (
                    <span className="text-xs text-slate-500">
                      b. {formatDate(String(lead.dateOfBirth))}
                    </span>
                  )}
                  {lead.phoneNumber && (
                    <span className="text-xs font-mono text-slate-600">{lead.phoneNumber}</span>
                  )}
                </div>
                {(lead.attendantName || lead.attendantContactNo) && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Attendant:{' '}
                    <span className="font-semibold text-slate-600">{display(lead.attendantName)}</span>
                    {lead.attendantContactNo && (
                      <span className="text-slate-400"> · {lead.attendantContactNo}</span>
                    )}
                  </p>
                )}
              </div>

              {/* right: ref + bill */}
              <div className="flex flex-col items-end gap-2.5 shrink-0">
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Ref</p>
                  <p className="font-mono text-sm font-bold text-slate-600">{lead.leadRef}</p>
                </div>
                {billAmountDisplay !== EM_DASH && (
                  <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 px-5 py-3 text-right shadow-sm">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-100">
                      Tentative Bill
                    </p>
                    <p className="text-[22px] font-bold text-white leading-tight mt-0.5">
                      {billAmountDisplay}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Hospital + key dates strip ── */}
            {(rec || lead.hospitalName) && (
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(rec?.admittingHospital || lead.hospitalName) && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Hospital
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {display(rec?.admittingHospital || lead.hospitalName)}
                    </p>
                  </div>
                )}
                {rec?.admissionDate && (
                  <div className="rounded-lg bg-blue-50 px-3 py-2 border border-blue-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500 mb-0.5">
                      Admission
                    </p>
                    <p className="text-sm font-semibold text-blue-800">
                      {formatDate(rec.admissionDate)}
                      {rec.admissionTime ? ` · ${rec.admissionTime}` : ''}
                    </p>
                  </div>
                )}
                {(rec?.surgeryDate || rec?.newSurgeryDate) && (
                  <div className={cn('rounded-lg px-3 py-2 border', isRescheduled ? 'bg-amber-50 border-amber-100' : 'bg-purple-50 border-purple-100')}>
                    <p className={cn('text-[9px] font-bold uppercase tracking-wider mb-0.5', isRescheduled ? 'text-amber-500' : 'text-purple-500')}>
                      Surgery
                      {isRescheduled && (
                        <span className="ml-1 normal-case tracking-normal font-semibold text-amber-500">
                          (rescheduled)
                        </span>
                      )}
                    </p>
                    <p className={cn('text-sm font-semibold', isRescheduled ? 'text-amber-800' : 'text-purple-800')}>
                      {effectiveSurgeryDate}
                      {rec?.surgeryTime && !isRescheduled ? ` · ${rec.surgeryTime}` : ''}
                    </p>
                  </div>
                )}
                {rec?.ipdDischargeDate && (
                  <div className="rounded-lg bg-green-50 px-3 py-2 border border-green-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-green-500 mb-0.5">
                      Discharged
                    </p>
                    <p className="text-sm font-semibold text-green-800">
                      {formatDate(rec.ipdDischargeDate)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Main sections ── */}
        <div className="space-y-8 print:space-y-6">

          {/* Patient + Clinical — two column */}
          <div className="grid sm:grid-cols-2 gap-8 print:grid-cols-2 print:gap-6">
            <InfoSection title="Patient">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Phone" value={display(lead.phoneNumber)} />
                <Field label="Profession" value={display(lead.profession)} />
                <Field label="City" value={display(kyp?.location)} />
                <Field label="Area" value={display(kyp?.area)} />
                <Field label="Circle" value={display(lead.circle)} />
                {lead.attendantName && (
                  <Field label="Attendant" value={display(lead.attendantName)} />
                )}
                {lead.attendantContactNo && (
                  <Field label="Attendant contact" value={display(lead.attendantContactNo)} />
                )}
              </div>
            </InfoSection>

            <InfoSection title="Clinical details">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Field
                  label="Treatment / disease"
                  value={display(kyp?.disease || lead.treatment)}
                  className="col-span-2"
                />
                <Field label="Category" value={display(lead.category)} />
                <Field label="Grade" value={display(lead.quantityGrade)} />
                <Field label="Anesthesia" value={display(lead.anesthesia)} />
                <Field label="Surgeon" value={surgeonDisplay} />
                {lead.surgeonType && (
                  <Field label="Surgeon type" value={display(lead.surgeonType)} />
                )}
              </div>
            </InfoSection>
          </div>

          {/* Insurance */}
          <InfoSection title="Insurance">
            <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-4 gap-x-6 gap-y-4">
              <Field
                label="Insurance company"
                value={insuranceNameDisplay}
                className="col-span-2"
              />
              <Field label="Type" value={insuranceTypeDisplay} />
              <Field label="TPA" value={tpaDisplay} />
              <Field label="Sum insured" value={sumInsuredDisplay} />
              <Field label="Balance insured" value={balanceInsuredDisplay} />
              <Field label="Copay" value={copayDisplay} />
              <Field label="Capping" value={cappingDisplay} />
              <Field label="Room rent" value={roomRentDisplay} />
            </div>
          </InfoSection>

          {/* Pre-authorization */}
          {pre && (
            <InfoSection title="Pre-authorization">
              <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-4 gap-x-6 gap-y-4">
                <Field
                  label="Requested hospital"
                  value={display(pre.requestedHospitalName)}
                  className="sm:col-span-2"
                />
                <Field label="Room type" value={display(pre.requestedRoomType)} />
                <Field label="Approval status" value={humanizeEnum(pre.approvalStatus)} />
                <Field label="Approved amount" value={formatMoneyLike(pre.approvedAmount)} />
                <Field
                  label="Expected admission"
                  value={formatDate(pre.expectedAdmissionDate ?? undefined)}
                />
                <Field
                  label="Expected surgery"
                  value={formatDate(pre.expectedSurgeryDate ?? undefined)}
                />
                {pre.diseaseDescription?.trim() && (
                  <Field
                    label="Disease description"
                    value={<span className="whitespace-pre-wrap">{pre.diseaseDescription}</span>}
                    className="col-span-2 sm:col-span-3 print:col-span-4"
                  />
                )}
              </div>
            </InfoSection>
          )}

          {/* Hospital details (address / maps / notes — dates already in hero) */}
          {showHospitalDetails && (
            <InfoSection title="Hospital details">
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-3 gap-x-6 gap-y-4">
                <Field
                  label="Hospital / Clinic"
                  value={display(rec?.admittingHospital || lead.hospitalName)}
                  className="sm:col-span-2 print:col-span-2"
                />
                {rec?.hospitalAddress && (
                  <Field
                    label="Address"
                    value={display(rec.hospitalAddress)}
                    className="sm:col-span-2 print:col-span-2"
                  />
                )}
                {rec?.googleMapLocation?.trim() && (
                  <Field
                    label="Google Maps"
                    value={
                      <a
                        href={rec.googleMapLocation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline print:text-black text-xs"
                      >
                        View on Google Maps
                      </a>
                    }
                  />
                )}
                {rec?.tpa && <Field label="TPA" value={display(rec.tpa)} />}
                {rec?.notes?.trim() && (
                  <Field
                    label="Notes"
                    value={<span className="whitespace-pre-wrap text-[12px]">{rec.notes}</span>}
                    className="col-span-2 sm:col-span-2 print:col-span-3"
                  />
                )}
              </div>
            </InfoSection>
          )}

          {/* Instruments, implants & consumables */}
          {showInstrumentsSection && (
            <InfoSection title="Instruments, implants & consumables">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {(rec?.instrument?.trim() || lead.instrument?.trim()) && (
                  <Field
                    label="Instruments"
                    value={
                      <span className="whitespace-pre-wrap text-[12px]">
                        {rec?.instrument?.trim() || lead.instrument}
                      </span>
                    }
                  />
                )}
                {implantLine?.trim() && (
                  <Field
                    label="Implants"
                    value={<span className="whitespace-pre-wrap text-[12px]">{implantLine}</span>}
                  />
                )}
                {(consumablesLine?.trim() || lead.consumables?.trim()) && (
                  <Field
                    label="Consumables"
                    value={
                      <span className="whitespace-pre-wrap text-[12px]">
                        {consumablesLine?.trim() || lead.consumables}
                      </span>
                    }
                  />
                )}
                {restImplantBlock && (
                  <Field
                    label="Other"
                    value={
                      <span className="whitespace-pre-wrap text-[12px]">{restImplantBlock}</span>
                    }
                    className="col-span-2"
                  />
                )}
              </div>
            </InfoSection>
          )}

        </div>

        {/* ── Print footer ── */}
        <div className="hidden print:block mt-10 pt-4 border-t-2 border-blue-100 text-center">
          <p className="text-[10px] text-slate-500 font-medium">
            {lead.leadRef} &middot; {lead.patientName} &middot; Generated {printedAt}
          </p>
        </div>
      </div>

      {/* ── Bottom print button (screen only) ── */}
      <div className="print:hidden mt-6 border-t bg-white px-4 py-4 text-center">
        <Button size="lg" onClick={() => window.print()}>
          <PrinterIcon className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>
    </div>
  )
}
