'use client'

import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { PrinterIcon, ArrowLeft, FileText } from 'lucide-react'
import { getIpdStatusLabel } from '@/lib/ipd-status-labels'
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
    } | null
  } | null
}

const EM_DASH = '—'

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return EM_DASH
  try {
    return format(new Date(dateStr), 'dd MMM yyyy')
  } catch {
    return String(dateStr)
  }
}

const formatDateTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return EM_DASH
  try {
    return format(new Date(dateStr), 'dd MMM yyyy, HH:mm')
  } catch {
    return String(dateStr)
  }
}

function display(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return EM_DASH
  const s = typeof v === 'number' ? String(v) : String(v).trim()
  return s.length ? s : EM_DASH
}

function formatMoneyLike(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return EM_DASH
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return `₹${v.toLocaleString('en-IN')}`
  }
  const s = String(v).trim()
  if (!s) return EM_DASH
  const n = Number(s.replace(/[₹,\s]/g, ''))
  if (!Number.isNaN(n) && s.match(/^[\d.,\s₹-]+$/)) {
    return `₹${n.toLocaleString('en-IN')}`
  }
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

/** URLs for KYP id docs: prefers JSON arrays, falls back to legacy single URL. */
function kypMultiDocUrls(files: unknown, legacyUrl: string | null | undefined): string[] {
  const arr = Array.isArray(files) ? files : []
  const urls = arr
    .map((p: { url?: string } | string) => (typeof p === 'string' ? p : p?.url))
    .filter((u): u is string => Boolean(u && typeof u === 'string'))
  const dedup = [...new Set(urls)]
  if (dedup.length > 0) return dedup
  if (legacyUrl?.trim()) return [legacyUrl.trim()]
  return []
}

type DocItem = { title: string; url: string; isImage: boolean }

function isImageDocUrl(url: string): boolean {
  const u = url.toLowerCase()
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(u) || u.includes('jpg') || u.includes('png')
}

function buildUploadedDocuments(kyp: Lead['kypSubmission']): DocItem[] {
  const items: DocItem[] = []
  const add = (title: string, url: string | null | undefined) => {
    if (!url?.trim()) return
    const u = url.trim()
    items.push({ title, url: u, isImage: isImageDocUrl(u) })
  }

  if (!kyp) return []

  if (kyp.insuranceCardFileUrl) add('Insurance Card', kyp.insuranceCardFileUrl)
  kypMultiDocUrls(kyp.aadharFiles, kyp.aadharFileUrl).forEach((url, i, a) => {
    add(a.length > 1 ? `Aadhaar ${i + 1}` : 'Aadhaar', url)
  })
  kypMultiDocUrls(kyp.panFiles, kyp.panFileUrl).forEach((url, i, a) => {
    add(a.length > 1 ? `PAN ${i + 1}` : 'PAN', url)
  })
  if (kyp.prescriptionFileUrl) add('Prescription', kyp.prescriptionFileUrl)

  const processFiles = (files: unknown, typeLabel: string) => {
    if (!files) return
    const fileList = Array.isArray(files) ? files : []
    fileList.forEach((p: unknown, index: number) => {
      const url = typeof p === 'string' ? p : (p as { url?: string })?.url
      if (!url) return
      const title = fileList.length > 1 ? `${typeLabel} ${index + 1}` : typeLabel
      add(title, url)
    })
  }

  processFiles(kyp.diseasePhotos, 'Disease photo')
  processFiles(kyp.otherFiles, 'Additional document')
  processFiles(kyp.preAuthData?.diseaseImages, 'Disease image')
  processFiles(kyp.preAuthData?.investigationFileUrls, 'Investigation')
  processFiles(kyp.preAuthData?.prescriptionFiles, 'Pre-auth prescription')

  return items.filter(
    (item, index, self) => index === self.findIndex((t) => t.url === item.url)
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('print:break-inside-avoid', className)}>
      <h2 className="mb-3 border-b border-blue-200 pb-1.5">
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-blue-600/90">
          {title.toUpperCase()}
        </span>
        <span className="mt-1 block text-base font-semibold text-blue-900">{title}</span>
      </h2>
      {children}
    </section>
  )
}

function FieldRows({
  rows,
}: {
  rows: { label: string; value: React.ReactNode }[]
}) {
  return (
    <div className="rounded-sm border border-blue-100 overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={row.label + String(i)}
          className={cn(
            'grid grid-cols-1 sm:grid-cols-[minmax(140px,180px)_1fr] gap-x-4 gap-y-0.5 px-3 py-2 text-sm',
            i % 2 === 0 ? 'bg-blue-50/50 print:bg-white' : 'bg-white'
          )}
        >
          <div className="text-muted-foreground font-medium">{row.label}</div>
          <div className="text-foreground min-w-0 break-words">{row.value}</div>
        </div>
      ))}
    </div>
  )
}

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-blue-200 bg-white p-8 text-center shadow-sm">
        <p className="text-muted-foreground text-sm">You do not have permission to view this page.</p>
        <Button variant="outline" className="mt-6 w-full border-blue-300 text-blue-800" onClick={onBack}>
          Go Back
        </Button>
      </div>
    </div>
  )
}

function NotFound({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-blue-200 bg-white p-8 text-center shadow-sm">
        <p className="text-muted-foreground text-sm">{message}</p>
        <Button variant="outline" className="mt-6 w-full border-blue-300 text-blue-800" onClick={onBack}>
          Go Back
        </Button>
      </div>
    </div>
  )
}

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

  if (!isAuthorized) {
    return <AccessDenied onBack={() => router.back()} />
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-muted-foreground">Loading patient summary…</p>
      </div>
    )
  }

  if (!lead) {
    return <NotFound message="Patient record not found." onBack={() => router.back()} />
  }

  const rec = lead.admissionRecord
  const kyp = lead.kypSubmission
  const pre = kyp?.preAuthData
  const uploadedDocuments = buildUploadedDocuments(kyp)

  const implantConsumablesStr = rec?.implantConsumables || ''
  const implantLine = implantConsumablesStr
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('implants:'))
  const consumablesLine = implantConsumablesStr
    .split('\n')
    .find((l) => l.trim().toLowerCase().startsWith('consumables:'))
  const restImplantBlock = implantConsumablesStr
    .split('\n')
    .filter(
      (l) =>
        !l.trim().toLowerCase().startsWith('implants:') &&
        !l.trim().toLowerCase().startsWith('consumables:')
    )
    .join('\n')
    .trim()

  const insuranceNameDisplay =
    pre?.insurance?.trim() || lead.insuranceName?.trim() || EM_DASH
  const insuranceTypeDisplay = display(
    pre?.insuranceType || kyp?.insuranceType || lead.insuranceType
  )
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

  const showInstrumentsSection =
    !!rec ||
    !!(lead.instrument?.trim()) ||
    !!(lead.consumables?.trim()) ||
    !!implantLine ||
    !!consumablesLine ||
    !!restImplantBlock

  const surgeonDisplay = display(lead.ipdDrName || lead.surgeonName)

  const printedAt = format(new Date(), 'dd MMM yyyy, HH:mm')

  return (
    <div className="min-h-screen bg-white text-foreground print:bg-white">
      {/* Screen toolbar */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-4 border-b border-blue-200 bg-blue-50 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-blue-900">Patient case summary</h1>
          <p className="text-sm text-blue-800/80">
            {lead.patientName} · {lead.leadRef}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-blue-300" onClick={() => router.back()}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800" onClick={() => window.print()}>
            <PrinterIcon className="mr-1 h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Print header */}
        <header className="mb-8 hidden print:block print:break-after-avoid">
          <div className="border-b-2 border-blue-800 pb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-800">Mediend CRM</p>
            <h1 className="mt-1 text-2xl font-bold text-blue-950">Patient case summary</h1>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{lead.leadRef}</span>
              <span className="mx-2 text-slate-400">·</span>
              Printed {printedAt}
            </p>
          </div>
        </header>

        {/* Screen-only title block (print uses header above) */}
        <div className="mb-8 print:hidden">
          <div className="rounded-md bg-blue-700 px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Mediend CRM</p>
            <h1 className="mt-0.5 text-xl font-bold">Patient case summary</h1>
            <p className="mt-1 text-sm text-blue-100">
              {lead.leadRef} · Generated {printedAt}
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <Section title="Patient information">
            <FieldRows
              rows={[
                { label: 'Patient name', value: display(lead.patientName) },
                { label: 'Lead reference', value: display(lead.leadRef) },
                { label: 'Age', value: lead.age != null ? String(lead.age) : EM_DASH },
                { label: 'Sex', value: display(lead.sex) },
                {
                  label: 'Date of birth',
                  value: lead.dateOfBirth ? formatDate(String(lead.dateOfBirth)) : EM_DASH,
                },
                { label: 'Profession', value: display(lead.profession) },
                { label: 'Phone', value: display(lead.phoneNumber) },
                { label: 'Attendant name', value: display(lead.attendantName) },
                { label: 'Attendant contact', value: display(lead.attendantContactNo) },
              ]}
            />
          </Section>

          <div className="border-t border-blue-100" />

          <Section title="Clinical details">
            <FieldRows
              rows={[
                { label: 'Treatment / disease', value: display(kyp?.disease || lead.treatment) },
                { label: 'Category', value: display(lead.category) },
                { label: 'Grade (quantity)', value: display(lead.quantityGrade) },
                { label: 'Anesthesia', value: display(lead.anesthesia) },
                { label: 'Surgeon (IPD / treating)', value: surgeonDisplay },
                { label: 'Surgeon name (lead)', value: display(lead.surgeonName) },
                { label: 'Surgeon type', value: display(lead.surgeonType) },
              ]}
            />
          </Section>

          <div className="border-t border-blue-100" />

          <Section title="Location">
            <FieldRows
              rows={[
                { label: 'City', value: display(kyp?.location) },
                { label: 'Area', value: display(kyp?.area) },
                { label: 'Circle', value: display(lead.circle) },
              ]}
            />
          </Section>

          <div className="border-t border-blue-100" />

          <Section title="Flow and status">
            <FieldRows
              rows={[
                { label: 'Flow type', value: humanizeEnum(lead.flowType) },
                { label: 'Mode of payment', value: humanizeEnum(lead.modeOfPayment) },
                { label: 'Pipeline stage', value: humanizeEnum(lead.pipelineStage) },
                { label: 'Case stage', value: humanizeEnum(lead.caseStage) },
                { label: 'Bill amount (lead)', value: formatMoneyLike(lead.billAmount) },
              ]}
            />
          </Section>

          <div className="border-t border-blue-100" />

          <Section title="Insurance details">
            <FieldRows
              rows={[
                { label: 'Insurance company', value: insuranceNameDisplay },
                { label: 'Insurance type', value: insuranceTypeDisplay },
                { label: 'TPA', value: tpaDisplay },
                { label: 'Sum insured', value: sumInsuredDisplay },
                { label: 'Balance insured', value: balanceInsuredDisplay },
                { label: 'Copay', value: copayDisplay },
                { label: 'Capping', value: cappingDisplay },
                { label: 'Room rent (policy / pre-auth)', value: roomRentDisplay },
              ]}
            />
          </Section>

          {pre && (
            <>
              <div className="border-t border-blue-100" />
              <Section title="Pre-authorization">
                <FieldRows
                  rows={[
                    { label: 'Requested hospital', value: display(pre.requestedHospitalName) },
                    { label: 'Requested room type', value: display(pre.requestedRoomType) },
                    { label: 'Approval status', value: humanizeEnum(pre.approvalStatus) },
                    {
                      label: 'Approved amount',
                      value: formatMoneyLike(pre.approvedAmount),
                    },
                    {
                      label: 'Expected admission',
                      value: formatDate(pre.expectedAdmissionDate ?? undefined),
                    },
                    {
                      label: 'Expected surgery',
                      value: formatDate(pre.expectedSurgeryDate ?? undefined),
                    },
                    {
                      label: 'Disease description',
                      value: pre.diseaseDescription?.trim() ? (
                        <span className="whitespace-pre-wrap">{pre.diseaseDescription}</span>
                      ) : (
                        EM_DASH
                      ),
                    },
                  ]}
                />
              </Section>
            </>
          )}

          {rec && (
            <>
              <div className="border-t border-blue-100" />
              <Section title="Hospital and admission">
                <FieldRows
                  rows={[
                    {
                      label: 'Hospital name',
                      value: display(rec.admittingHospital || lead.hospitalName),
                    },
                    { label: 'Address', value: display(rec.hospitalAddress) },
                    {
                      label: 'Google Maps',
                      value: rec.googleMapLocation?.trim() ? (
                        <a
                          href={rec.googleMapLocation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline print:text-black"
                        >
                          {rec.googleMapLocation}
                        </a>
                      ) : (
                        EM_DASH
                      ),
                    },
                    { label: 'TPA (at admission)', value: display(rec.tpa) },
                    { label: 'Admission date', value: formatDate(rec.admissionDate) },
                    { label: 'Admission time', value: display(rec.admissionTime) },
                    { label: 'Surgery date', value: formatDate(rec.surgeryDate) },
                    { label: 'OT / surgery time', value: display(rec.surgeryTime) },
                    {
                      label: 'New surgery date (if postponed)',
                      value: formatDate(rec.newSurgeryDate),
                    },
                    {
                      label: 'IPD status',
                      value: rec.ipdStatus ? getIpdStatusLabel(rec.ipdStatus) : EM_DASH,
                    },
                    { label: 'IPD status reason', value: display(rec.ipdStatusReason) },
                    {
                      label: 'IPD status notes',
                      value: rec.ipdStatusNotes?.trim() ? (
                        <span className="whitespace-pre-wrap">{rec.ipdStatusNotes}</span>
                      ) : (
                        EM_DASH
                      ),
                    },
                    {
                      label: 'Status updated at',
                      value: rec.ipdStatusUpdatedAt
                        ? formatDateTime(rec.ipdStatusUpdatedAt)
                        : EM_DASH,
                    },
                    {
                      label: 'IPD discharge date',
                      value: formatDate(rec.ipdDischargeDate),
                    },
                  ]}
                />
              </Section>
            </>
          )}

          {showInstrumentsSection && (
            <>
              <div className="border-t border-blue-100" />
              <Section title="Instruments, implants and consumables">
                <FieldRows
                  rows={[
                    {
                      label: 'Instruments (admission)',
                      value: rec?.instrument?.trim() ? (
                        <span className="whitespace-pre-wrap text-sm">{rec.instrument}</span>
                      ) : (
                        EM_DASH
                      ),
                    },
                    {
                      label: 'Instruments (lead)',
                      value: lead.instrument?.trim() ? (
                        <span className="whitespace-pre-wrap text-sm">{lead.instrument}</span>
                      ) : (
                        EM_DASH
                      ),
                    },
                    {
                      label: 'Implants',
                      value: implantLine?.trim() ? (
                        <span className="whitespace-pre-wrap text-sm">{implantLine}</span>
                      ) : (
                        EM_DASH
                      ),
                    },
                    {
                      label: 'Consumables',
                      value: consumablesLine?.trim() ? (
                        <span className="whitespace-pre-wrap text-sm">{consumablesLine}</span>
                      ) : lead.consumables?.trim() ? (
                        <span className="whitespace-pre-wrap text-sm">{lead.consumables}</span>
                      ) : (
                        EM_DASH
                      ),
                    },
                    ...(restImplantBlock
                      ? [
                          {
                            label: 'Implant / consumables (other)',
                            value: (
                              <span className="whitespace-pre-wrap text-sm">{restImplantBlock}</span>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </Section>
            </>
          )}

          {uploadedDocuments.length > 0 && (
            <>
              <div className="border-t border-blue-100" />
              <Section title="Documents">
                <p className="mb-4 text-xs text-muted-foreground">
                  Uploaded files from KYP and pre-authorization (images print inline where supported).
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {uploadedDocuments.map((doc, index) => (
                    <div
                      key={`${doc.url}-${index}`}
                      className="flex flex-col overflow-hidden rounded border border-blue-200 print:break-inside-avoid"
                    >
                      <div className="flex h-[200px] w-full shrink-0 items-center justify-center overflow-hidden bg-slate-100">
                        {doc.isImage ? (
                          <>
                            <img
                              src={doc.url}
                              alt={doc.title}
                              className="hidden max-h-full max-w-full object-contain print:block"
                            />
                            <iframe
                              src={doc.url}
                              title={doc.title}
                              className="h-full w-full border-0 select-none print:hidden"
                              style={{ overflow: 'hidden' }}
                            />
                          </>
                        ) : (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center gap-2 p-4 text-slate-500 no-underline hover:text-blue-700"
                          >
                            <FileText className="h-12 w-12" />
                            <span className="line-clamp-2 text-center text-xs">{doc.title}</span>
                            <span className="text-xs font-medium text-blue-700">Open</span>
                          </a>
                        )}
                      </div>
                      <div className="shrink-0 border-t border-blue-100 bg-white p-2">
                        <p className="truncate text-sm font-medium text-slate-900" title={doc.title}>
                          {doc.title}
                        </p>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-xs text-blue-700 underline"
                        >
                          Open file
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>

      <div className="print:hidden border-t border-blue-100 bg-blue-50/50 p-4 text-center">
        <Button size="lg" className="bg-blue-700 hover:bg-blue-800" onClick={() => window.print()}>
          <PrinterIcon className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>
    </div>
  )
}
