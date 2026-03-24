'use client'

import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { PrinterIcon, ArrowLeft, FileText } from 'lucide-react'
import { getIpdStatusLabel } from '@/lib/ipd-status-labels'

interface Lead {
  id: string
  patientName: string
  leadRef: string
  age?: number | null
  sex?: string | null
  hospitalName: string
  treatment?: string | null
  ipdDrName?: string | null
  admissionRecord?: {
    id: string
    admissionDate?: string
    admissionTime?: string
    surgeryDate?: string
    surgeryTime?: string
    admittingHospital?: string
    hospitalAddress?: string
    googleMapLocation?: string
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
    preAuthData?: {
      diseaseImages?: unknown
      investigationFileUrls?: unknown
      prescriptionFiles?: unknown
    } | null
  } | null
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  try {
    return format(new Date(dateStr), 'dd MMM yyyy')
  } catch {
    return dateStr
  }
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

export default function IPDPrintPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const leadId = params.leadId as string

  const isAuthorized = user && ['BD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role)

  const { data: lead, isLoading } = useQuery<Lead | null>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId && isAuthorized,
  })

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You do not have permission to view this page.
            </p>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading IPD details...</div>
      </div>
    )
  }

  if (!lead || !lead.admissionRecord) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              IPD details not found for this patient.
            </p>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.back()}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const rec = lead.admissionRecord
  const uploadedDocuments = buildUploadedDocuments(lead.kypSubmission)

  // Split implantConsumables into Implants and Consumables lines
  const implantConsumablesStr = rec.implantConsumables || ''
  const implantLine = implantConsumablesStr.split('\n').find((l) => l.trim().toLowerCase().startsWith('implants:'))
  const consumablesLine = implantConsumablesStr.split('\n').find((l) => l.trim().toLowerCase().startsWith('consumables:'))

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Header - hidden in print */}
      <div className="print:hidden border-b border-teal-200 bg-teal-50/50 p-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-teal-800">IPD Admission Details</h1>
          <p className="text-slate-600">{lead.patientName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <PrinterIcon className="h-4 w-4 mr-1" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="hidden print:block mb-6 print:break-after-avoid">
          <h1 className="text-2xl font-bold mb-2 text-teal-700">IPD Admission Details</h1>
          <p className="text-sm text-slate-600">{lead.patientName}</p>
        </div>

        {/* Patient details: name, age, sex */}
        <div className="mb-6 p-4 rounded-lg bg-slate-50/80 print:bg-white print:break-inside-avoid border-l-4 border-teal-500">
          <h2 className="text-lg font-semibold mb-3 text-teal-700 border-b border-teal-200 pb-2">Patient Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Patient Name</p>
              <p className="text-base">{lead.patientName}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Age</p>
              <p className="text-base">{lead.age != null ? lead.age : '-'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Sex</p>
              <p className="text-base">{lead.sex ?? '-'}</p>
            </div>
          </div>
        </div>

        {/* Admission & Surgery */}
        <div className="mb-6 p-4 rounded-lg bg-blue-50/80 print:bg-white print:break-inside-avoid border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-3 text-blue-700 border-b border-blue-200 pb-2">Admission & Surgery</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600">Admission Date</p>
              <p className="text-base">{formatDate(rec.admissionDate)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Admission Time</p>
              <p className="text-base">{rec.admissionTime || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Surgery Date</p>
              <p className="text-base">{formatDate(rec.surgeryDate)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">OT Time</p>
              <p className="text-base">{rec.surgeryTime || '-'}</p>
            </div>
          </div>
        </div>

        {/* Treatment / Surgery */}
        <div className="mb-6 p-4 rounded-lg bg-violet-50/80 print:bg-white print:break-inside-avoid border-l-4 border-violet-500">
          <h2 className="text-lg font-semibold mb-3 text-violet-700 border-b border-violet-200 pb-2">Treatment / Surgery</h2>
          <p className="text-base">{lead.treatment ?? '-'}</p>
        </div>

        {/* Surgeon */}
        <div className="mb-6 p-4 rounded-lg bg-amber-50/80 print:bg-white print:break-inside-avoid border-l-4 border-amber-500">
          <h2 className="text-lg font-semibold mb-3 text-amber-800 border-b border-amber-200 pb-2">Surgeon</h2>
          <p className="text-base">{lead.ipdDrName ?? '-'}</p>
        </div>

        {/* Hospital */}
        <div className="mb-6 p-4 rounded-lg bg-emerald-50/80 print:bg-white print:break-inside-avoid border-l-4 border-emerald-500">
          <h2 className="text-lg font-semibold mb-3 text-emerald-700 border-b border-emerald-200 pb-2">Hospital</h2>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-600">Hospital Name</p>
              <p className="text-base">{rec.admittingHospital || lead.hospitalName || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Address</p>
              <p className="text-base">{rec.hospitalAddress || '-'}</p>
            </div>
            {rec.googleMapLocation && (
              <div>
                <a
                  href={rec.googleMapLocation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  View on Google Maps
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Instruments */}
        {(rec.instrument?.trim() ?? '') && (
          <div className="mb-6 p-4 rounded-lg bg-orange-50/80 print:bg-white print:break-inside-avoid border-l-4 border-orange-500">
            <h2 className="text-lg font-semibold mb-3 text-orange-700 border-b border-orange-200 pb-2">Instruments</h2>
            <p className="text-sm whitespace-pre-line">{rec.instrument}</p>
          </div>
        )}

        {/* Implants */}
        {implantLine && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50/80 print:bg-white print:break-inside-avoid border-l-4 border-rose-500">
            <h2 className="text-lg font-semibold mb-3 text-rose-700 border-b border-rose-200 pb-2">Implants</h2>
            <p className="text-sm whitespace-pre-line">{implantLine}</p>
          </div>
        )}

        {/* Consumables */}
        {consumablesLine && (
          <div className="mb-6 p-4 rounded-lg bg-pink-50/80 print:bg-white print:break-inside-avoid border-l-4 border-pink-500">
            <h2 className="text-lg font-semibold mb-3 text-pink-700 border-b border-pink-200 pb-2">Consumables</h2>
            <p className="text-sm whitespace-pre-line">{consumablesLine}</p>
          </div>
        )}

        {/* IPD Status, Notes */}
        {rec.ipdStatus && (
          <div className="mb-6 p-4 rounded-lg bg-slate-100 print:bg-white print:break-inside-avoid border-l-4 border-slate-400">
            <h3 className="font-semibold mb-2 text-slate-700">IPD Status</h3>
            <p className="text-base font-semibold text-gray-700">{getIpdStatusLabel(rec.ipdStatus)}</p>
            {rec.ipdStatusUpdatedAt && (
              <p className="text-sm text-gray-600 mt-1">
                Updated {format(new Date(rec.ipdStatusUpdatedAt), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
        )}
        {rec.notes?.trim() && (
          <div className="mb-6 p-4 rounded-lg bg-slate-50/80 print:bg-white print:break-inside-avoid border-l-4 border-slate-400">
            <h2 className="text-lg font-semibold mb-3 text-slate-700 border-b border-slate-200 pb-2">Additional Notes</h2>
            <p className="text-sm whitespace-pre-line">{rec.notes}</p>
          </div>
        )}

        {/* Documents (KYP + pre-auth uploads) */}
        {uploadedDocuments.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-teal-50/80 print:bg-white print:break-inside-avoid border-l-4 border-teal-600">
            <h2 className="text-lg font-semibold mb-3 text-teal-800 border-b border-teal-200 pb-2">Documents</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {uploadedDocuments.map((doc, index) => (
                <div
                  key={`${doc.url}-${index}`}
                  className="flex flex-col rounded-lg border-2 border-gray-200 overflow-hidden print:break-inside-avoid"
                >
                  <div className="w-full h-[200px] shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
                    {doc.isImage ? (
                      <>
                        <img
                          src={doc.url}
                          alt={doc.title}
                          className="max-h-full max-w-full object-contain hidden print:block"
                        />
                        <iframe
                          src={doc.url}
                          title={doc.title}
                          className="w-full h-full border-0 pointer-events-none select-none print:hidden"
                          style={{ overflow: 'hidden' }}
                        />
                      </>
                    ) : (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-600 p-4 no-underline"
                      >
                        <FileText className="w-12 h-12" />
                        <span className="text-xs text-center line-clamp-2">{doc.title}</span>
                        <span className="text-xs font-medium">Open in new tab</span>
                      </a>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-200 bg-white shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={doc.title}>
                      {doc.title}
                    </p>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="print:hidden border-t p-4 text-center">
        <Button size="lg" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>
    </div>
  )
}
