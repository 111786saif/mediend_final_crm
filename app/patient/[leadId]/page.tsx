'use client'

import { IPDCashForm } from '@/components/admission/ipd-cash-form'
import { IPDDetailsCard } from '@/components/admission/ipd-details-card'
import { IPDDetailsForm } from '@/components/admission/ipd-details-form'
import { IPDMarkComponent } from '@/components/admission/ipd-mark-component'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { PatientDischargeInfo } from '@/components/discharge/patient-discharge-info'
import { InitiateFormCard } from '@/components/insurance/initiate-form-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, Building2, Calendar as CalendarIcon, CheckCircle2, Clock, Copy, ExternalLink, File, FileDown, FileText, MapPin, MessageCircle, Pencil, Plus, Receipt, RefreshCw, Shield, Stethoscope, Tag, User, Wallet, XCircle } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'

import { ActivityTimeline } from '@/components/case/activity-timeline'
import { CashStageProgress } from '@/components/case/cash-stage-progress'
import { StageProgress } from '@/components/case/stage-progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CaseStage, FlowType } from '@/generated/prisma/enums'
import {
  canAddKYPDetails,
  canCompletePreAuth,
  canEditDischargeSheet,
  canEditIPDDetails,
  canEditKYP,
  canFillCashDischarge,
  canFillInitiateForm,
  canFillIPDCashForm,
  canGeneratePDF,
  canInitiate,
  canMarkIPD,
  canMarkLost,
  canModifyHospitals,
  canRaisePreAuth,
  canRevertCashMode,
  canStartCashMode,
  canSuggestHospitals,
  canViewInitiateForm,
  isDischargeBlockedByInitiateForm,
  isReadOnlyPatientRole
} from '@/lib/case-permissions'
import { getKYPStatusLabel } from '@/lib/kyp-status-labels'
import { resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { format, formatDistanceToNow } from 'date-fns'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

type KypUploadedFile = { name?: string; url?: string }

/** URLs for KYP id docs: prefers JSON arrays, falls back to legacy single URL. */
function kypMultiDocUrls(
  files: unknown,
  legacyUrl: string | null | undefined
): string[] {
  const arr = Array.isArray(files) ? files : []
  const urls = arr
    .map((p: KypUploadedFile | string) => (typeof p === 'string' ? p : p?.url))
    .filter((u): u is string => Boolean(u && typeof u === 'string'))
  const dedup = [...new Set(urls)]
  if (dedup.length > 0) return dedup
  if (legacyUrl?.trim()) return [legacyUrl.trim()]
  return []
}

function kypMultiDocList(
  files: unknown,
  legacyUrl: string | null | undefined
): { name: string; url: string }[] {
  const arr = Array.isArray(files) ? files : []
  const out: { name: string; url: string }[] = []
  for (const p of arr) {
    const url = typeof p === 'string' ? p : p?.url
    if (!url) continue
    const name =
      typeof p === 'object' && p && typeof p.name === 'string' && p.name.trim()
        ? p.name.trim()
        : 'Document'
    out.push({ name, url })
  }
  const seen = new Set<string>()
  const unique = out.filter((x) => {
    if (seen.has(x.url)) return false
    seen.add(x.url)
    return true
  })
  if (unique.length > 0) return unique
  if (legacyUrl?.trim()) return [{ name: 'Document', url: legacyUrl.trim() }]
  return []
}

interface Lead {
  id: string
  leadRef: string
  patientName: string
  age?: number
  sex?: string
  phoneNumber: string
  alternateNumber?: string | null
  attendantName?: string | null
  attendantContactNo?: string | null
  circle?: string
  hospitalName: string
  insuranceName: string | null
  insuranceType?: string | null
  ipdDrName: string | null
  treatment: string | null
  category: string | null
  quantityGrade?: string | null
  anesthesia?: string | null
  surgeonName?: string | null
  surgeonType?: string | null
  status: string
  pipelineStage: string
  caseStage: CaseStage
  flowType?: FlowType | null
  collectedByMediend?: number | null
  collectedByHospital?: number | null
  modeOfPayment?: string | null
  billAmount?: number | null
  settledTotal?: number | null
  discount?: number | null
  copay?: number | null
  deduction?: number | null
  remarks?: string | null
  bd?: { name?: string; manager?: { name?: string } | null } | null
  leadEntryDate?: string | null
  assignedDate?: string | null
  createdDate?: string | null
  surgeryDate?: string | null
  month?: string | null
  profession?: string | null
  teamLeadId?: number | null
  kypSubmission?: {
    id: string
    status: string
    submittedAt: string
    insuranceType?: string | null
    location?: string | null
    area?: string | null
    aadhar?: string | null
    pan?: string | null
    insuranceCard?: string | null
    disease?: string | null
    remark?: string | null
    patientConsent?: boolean
    aadharFileUrl?: string | null
    panFileUrl?: string | null
    aadharFiles?: Array<{ name: string; url: string }> | null
    panFiles?: Array<{ name: string; url: string }> | null
    insuranceCardFileUrl?: string | null
    prescriptionFileUrl?: string | null
    diseasePhotos?: Array<{ name: string; url: string }> | null
    otherFiles?: Array<{ name: string; url: string }> | null
    submittedBy: {
      id: string
      name: string
    }
    preAuthData?: {
      id: string
      sumInsured: string | null
      balanceInsured: string | null
      roomRent: string | null
      capping: number | null
      copay: string | null
      icu: string | null
      hospitalNameSuggestion: string | null
      hospitalSuggestions?: string[] | null
      roomTypes?: Array<{ name: string; rent: string }> | null
      suggestedHospitals?: Array<{
        id: string
        hospitalName: string
        suggestedDoctor?: string | null
        tentativeBill?: number | null
        roomRentGeneral?: number | null
        roomRentSingle?: number | null
        roomRentDeluxe?: number | null
        roomRentSemiPrivate?: number | null
        notes?: string | null
      }> | null
      insurance: string | null
      tpa: string | null
      requestedHospitalName?: string | null
      requestedRoomType?: string | null
      diseaseDescription?: string | null
      diseaseImages?: Array<{ name: string; url: string }> | null
      investigationFileUrls?: Array<{ name: string; url: string }> | null
      prescriptionFiles?: Array<{ name: string; url: string }> | null
      preAuthRaisedAt?: string | null
      handledAt?: string | null
      approvalStatus?: string | null
      approvalNotes?: string | null
      rejectionReason?: string | null
      handledBy?: {
        id: string
        name: string
      } | null
      preAuthRaisedBy?: {
        id: string
        name: string
      } | null
    } | null
    followUpData?: {
      id: string
    } | null
  } | null
  dischargeSheet?: {
    id: string
    billAmount?: number | null
    cashOrDedPaid?: number | null
    collectedByHospital?: number | null
    collectedByMediend?: number | null
    deductionAmount?: number | null
    discountAmount?: number | null
    settlementPart?: number | null
  } | null
  insuranceInitiateForm?: {
    id: string
  } | null
  admissionRecord?: {
    id: string
    ipdStatus?: string | null
    ipdStatusReason?: string | null
    ipdStatusNotes?: string | null
    ipdStatusUpdatedAt?: string | null
    newSurgeryDate?: string | null
    ipdDischargeDate?: string | null
    admissionDate?: string
    admissionTime?: string | null
    surgeryDate?: string | null
    surgeryTime?: string | null
    admittingHospital?: string | null
    hospitalAddress?: string | null
    googleMapLocation?: string | null
    tpa?: string | null
    instrument?: string | null
    implantConsumables?: string | null
    notes?: string | null
  } | null
}

function extractLatestAmountFromRemarks(
  remarks: string | null | undefined,
  key: string,
): number | undefined {
  if (!remarks) return undefined
  const regex = new RegExp(`${key}:\\s*([\\d.]+)`, 'gi')
  const matches = [...remarks.matchAll(regex)]
  if (matches.length === 0) return undefined
  const value = Number(matches[matches.length - 1][1])
  return Number.isFinite(value) ? value : undefined
}

interface KYPSubmission {
  id: string
  leadId: string
  aadhar: string | null
  pan: string | null
  insuranceCard: string | null
  disease: string | null
  location: string | null
  area: string | null
  remark: string | null
  aadharFileUrl: string | null
  panFileUrl: string | null
  aadharFiles?: Array<{ name: string; url: string }> | null
  panFiles?: Array<{ name: string; url: string }> | null
  insuranceCardFileUrl: string | null
  prescriptionFileUrl: string | null
  diseasePhotos: Array<{ name: string; url: string }> | null
  otherFiles: Array<{ name: string; url: string }> | null
  status: 'PENDING' | 'KYP_DETAILS_ADDED' | 'PRE_AUTH_COMPLETE' | 'FOLLOW_UP_COMPLETE' | 'COMPLETED'
  submittedAt: string
  lead: {
    id: string
    leadRef: string
    patientName: string
    phoneNumber: string
    circle?: string | null
    hospitalName: string
  }
  submittedBy: {
    id: string
    name: string
  }
  preAuthData?: {
    id: string
    sumInsured: string | null
    balanceInsured?: string | null
    roomRent: string | null
    capping: string | null
    copay: string | null
    icu: string | null
    hospitalNameSuggestion: string | null
    hospitalSuggestions?: string[] | null
    roomTypes?: Array<{ name: string; rent: string }> | null
    suggestedHospitals?: Array<{
      id: string
      hospitalName: string
      suggestedDoctor?: string | null
      tentativeBill?: number | null
      roomRentGeneral?: number | null
      roomRentSingle?: number | null
      roomRentDeluxe?: number | null
      roomRentSemiPrivate?: number | null
      notes?: string | null
    }> | null
    insurance: string | null
    tpa: string | null
    requestedHospitalName?: string | null
    requestedRoomType?: string | null
    diseaseDescription?: string | null
    diseaseImages?: Array<{ name: string; url: string }> | null
    investigationFileUrls?: Array<{ name: string; url: string }> | null
    prescriptionFiles?: Array<{ name: string; url: string }> | null
    preAuthRaisedAt?: string | null
    handledAt?: string | null
    approvalStatus?: string | null
    approvalNotes?: string | null
    rejectionReason?: string | null
    handledBy?: {
      id: string
      name: string
    } | null
    preAuthRaisedBy?: {
      id: string
      name: string
    } | null
  } | null
  followUpData?: {
    id: string
    admissionDate: string | null
    surgeryDate: string | null
    prescription: string | null
    report: string | null
    hospitalName: string | null
    doctorName: string | null
    prescriptionFileUrl: string | null
    reportFileUrl: string | null
    updatedAt: string
    updatedBy: {
      id: string
      name: string
    } | null
  } | null
}

function DossierField({
  label,
  value,
  icon: Icon,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  mono?: boolean
}) {
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && (value.trim() === '' || value.trim() === '—'))
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-3 py-1.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {Icon && <Icon className="h-3 w-3 text-gray-400 dark:text-gray-500" />}
        <span>{label}</span>
      </dt>
      <dd
        className={cn(
          'min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100',
          mono && 'font-mono text-[13px]',
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {isEmpty ? (
          <span className="text-gray-300 dark:text-gray-700">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function DossierSectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-800">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700 dark:text-gray-200">
        {label}
      </p>
    </div>
  )
}

export default function PatientDetailsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string

  const { data: lead, isLoading, error } = useQuery<Lead, Error>({
    queryKey: ['lead', leadId],
    queryFn: () => apiGet<Lead>(`/api/leads/${leadId}`),
    enabled: !!leadId,
    retry: false,
  })

  const { data: kypSubmission, isLoading: isLoadingKYP } = useQuery<KYPSubmission | null>({
    queryKey: ['kyp-submission', leadId],
    queryFn: async () => {
      try {
        const submissions = await apiGet<KYPSubmission[]>(`/api/kyp?leadId=${leadId}`)
        if (!Array.isArray(submissions)) {
          console.error('Expected array from /api/kyp, got:', submissions)
          return null
        }
        return submissions[0] || null
      } catch (e) {
        console.error('Error fetching KYP submission:', e)
        return null
      }
    },
    enabled: !!leadId,
  })

  const { data: stageHistory } = useQuery<any[]>({
    queryKey: ['stage-history', leadId],
    queryFn: () => apiGet<any[]>(`/api/leads/${leadId}/stage-history`),
    enabled: !!leadId,
  })

  const { data: initiateFormData } = useQuery<any>({
    queryKey: ['insurance-initiate-form', leadId],
    queryFn: () => apiGet<any>(`/api/insurance-initiate-form?leadId=${leadId}`),
    enabled: !!leadId && (lead?.caseStage === CaseStage.PREAUTH_RAISED || lead?.caseStage === CaseStage.PREAUTH_COMPLETE || lead?.caseStage === CaseStage.INITIATED),
  })

  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [admitEditMode, setAdmitEditMode] = useState(false)
  const [showIPDCashModal, setShowIPDCashModal] = useState(false)
  const [showIPDMarkModal, setShowIPDMarkModal] = useState(false)
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false)
  const [markLostReason, setMarkLostReason] = useState<string>('')
  const [markLostDetail, setMarkLostDetail] = useState('')
  const [markLostSubmitting, setMarkLostSubmitting] = useState(false)
  const [switchingMode, setSwitchingMode] = useState(false)

  if (isLoading || isLoadingKYP) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading patient details...</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  if (error || !lead) {
    return (
      <AuthenticatedLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="text-destructive font-semibold text-lg">
            {error ? error.message : 'Patient not found'}
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </AuthenticatedLayout>
    )
  }

  const getStatusBadgeColor = (status: string) => {
    const badgeConfig: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      KYP_DETAILS_ADDED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      PRE_AUTH_COMPLETE: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      FOLLOW_UP_COMPLETE: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
      COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    }
    return badgeConfig[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge className={`border-0 ${getStatusBadgeColor(status)}`}>
        {getKYPStatusLabel(status)}
      </Badge>
    )
  }

  const getStageBadgeColor = (stage: CaseStage) => {
    const colors: Record<CaseStage, string> = {
      [CaseStage.NEW_LEAD]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
      [CaseStage.KYP_BASIC_PENDING]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300',
      [CaseStage.KYP_BASIC_COMPLETE]: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-300',
      [CaseStage.KYP_DETAILED_PENDING]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300',
      [CaseStage.KYP_DETAILED_COMPLETE]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300',
      [CaseStage.KYP_PENDING]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300',
      [CaseStage.KYP_COMPLETE]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300',
      [CaseStage.HOSPITALS_SUGGESTED]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
      [CaseStage.PREAUTH_RAISED]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 border-teal-300',
      [CaseStage.PREAUTH_COMPLETE]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
      [CaseStage.INITIATED]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300',
      [CaseStage.ADMITTED]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300',
      [CaseStage.DISCHARGED]: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-300',
      [CaseStage.IPD_DONE]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 border-teal-300',
      [CaseStage.PL_PENDING]: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300 border-gray-300',
      [CaseStage.OUTSTANDING]: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300 border-gray-300',
      // Cash Flow Stages
      [CaseStage.CASH_IPD_PENDING]: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300',
      [CaseStage.CASH_IPD_SUBMITTED]: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
      [CaseStage.CASH_APPROVED]: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300',
      [CaseStage.CASH_ON_HOLD]: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-300',
      [CaseStage.CASH_IPD_DONE]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 border-teal-300',
      [CaseStage.CASH_DISCHARGED]: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-300',
    }
    return colors[stage] || 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300 border-gray-300'
  }

  // Permission checks - cast user to match expected type
  const readOnly = !!(user && isReadOnlyPatientRole(user as any))
  const canRaise = !readOnly && user && canRaisePreAuth(user as any, lead)
  const canAddDetails = !readOnly && user && canAddKYPDetails(user as any, lead)
  const canComplete = !readOnly && user && canCompletePreAuth(user as any, lead)
  const canEdit = !readOnly && user && canEditKYP(user as any, lead)
  const canInit = !readOnly && user && canInitiate(user as any, lead)
  const canEditIPD = !readOnly && user && canEditIPDDetails(user as any, lead)
  const canMarkIPDStatus = !readOnly && user && canMarkIPD(user as any, lead)
  const canPDF = !readOnly && user && canGeneratePDF(user as any, lead)
  const canFillDischargeForm = !readOnly && user && canEditDischargeSheet(user as any, lead)
  const showMarkLost = !readOnly && user && canMarkLost(user as any, lead)
  const showSuggestHospitals = !readOnly && user && canSuggestHospitals(user as any, lead)
  const showModifyHospitals = !readOnly && user && canModifyHospitals(user as any, lead)
  const canFillInitiate = !readOnly && user && canFillInitiateForm(user as any, lead)
  const isDischargeBlocked = user && isDischargeBlockedByInitiateForm(user as any, lead)
  const initiateForm = initiateFormData?.initiateForm
  const isInitiateFormFilled =
    initiateForm &&
    (initiateForm.totalBillAmount != null && Number(initiateForm.totalBillAmount) > 0) &&
    initiateForm.copay !== null &&
    typeof initiateForm.copay === 'number'

  // Room rent from selected hospital + room type in pre-auth (previous stage)
  const roomRentFromPreAuth = (() => {
    const preAuth = lead?.kypSubmission?.preAuthData
    const hospitals = preAuth?.suggestedHospitals as Array<{
      hospitalName: string
      roomRentGeneral?: number | null
      roomRentSingle?: number | null
      roomRentDeluxe?: number | null
      roomRentSemiPrivate?: number | null
    }> | undefined
    const requestedName = preAuth?.requestedHospitalName?.trim()
    const requestedRoom = preAuth?.requestedRoomType?.trim()?.toLowerCase()
    if (!hospitals?.length || !requestedName || !requestedRoom) return undefined
    const hospital = hospitals.find(
      (h) => h.hospitalName?.trim()?.toLowerCase() === requestedName.toLowerCase()
    )
    if (!hospital) return undefined
    const key = requestedRoom.replace(/\s*-\s*/, '').replace(/\s+/g, '')
    const rent =
      key === 'general' ? hospital.roomRentGeneral :
        key === 'single' ? hospital.roomRentSingle :
          key === 'deluxe' ? hospital.roomRentDeluxe :
            (key === 'semiprivate' || key === 'semi-private') ? hospital.roomRentSemiPrivate :
              undefined
    return rent != null ? rent : undefined
  })()

  const copyIPDDetailsToClipboard = () => {
    if (!lead) return
    const rec = lead.admissionRecord
    const pre = lead.kypSubmission?.preAuthData
    const isCash = lead.flowType === 'CASH'
    const fmtDate = (d?: string | null) => {
      if (!d) return '—'
      try { return format(new Date(d), 'dd MMM yyyy') } catch { return d }
    }
    const fmtMoney = (v?: string | number | null) => {
      if (v == null || v === '') return '—'
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s]/g, ''))
      return isNaN(n) ? String(v) : `₹${n.toLocaleString('en-IN')}`
    }
    const preAuthDoctorName = (() => {
      const hospitals = pre?.suggestedHospitals
      const requested = pre?.requestedHospitalName?.trim()
      if (!hospitals?.length || !requested) return null
      const match = hospitals.find(h => h.hospitalName?.trim() === requested)
      return match?.suggestedDoctor ?? null
    })()
    const extractFromRemarks = (key: string): string | null => {
      const value = extractLatestAmountFromRemarks(lead.remarks, key)
      return value == null ? null : String(value)
    }
    const emiItems = lead.modeOfPayment === 'EMI' ? [
      `EMI Amount: ${extractFromRemarks('EMI Amount') ?? '—'}`,
      `Processing Fee: ${extractFromRemarks('Processing Fee') ?? '—'}`,
      `GST: ${extractFromRemarks('GST') ?? '—'}`,
      `Subvention Fee: ${extractFromRemarks('Subvention Fee') ?? '—'}`,
      `Final EMI Amount: ${extractFromRemarks('Final EMI Amount') ?? '—'}`,
    ] : []
    const totalCollectedAmount = extractFromRemarks('Collected')
    const discharge = lead.dischargeSheet
    const approvedAmount = (lead.settledTotal ?? 0) > 0 ? lead.settledTotal : discharge?.settlementPart
    const finalBillAmount = (lead.billAmount ?? 0) > 0 ? lead.billAmount : discharge?.billAmount
    const discountAmount = (lead.discount ?? 0) > 0 ? lead.discount : discharge?.discountAmount
    const deductionAmount = (lead.deduction ?? 0) > 0 ? lead.deduction : discharge?.deductionAmount
    const collectedByMediend = (lead.collectedByMediend ?? 0) > 0 ? lead.collectedByMediend : discharge?.collectedByMediend
    const collectedByHospital = (lead.collectedByHospital ?? 0) > 0 ? lead.collectedByHospital : discharge?.collectedByHospital
    const lines = [
      `*IPD Details — ${lead.patientName}*`,
      `Ref: ${lead.leadRef}`,
      '',
      `*Timeline*`,
      rec?.admissionDate ? `Admission: ${fmtDate(rec.admissionDate)}${rec.admissionTime ? ` at ${rec.admissionTime}` : ''}` : null,
      rec?.surgeryDate ? `Surgery: ${fmtDate(rec.newSurgeryDate || rec.surgeryDate)}${rec.surgeryTime ? ` at ${rec.surgeryTime}` : ''}` : null,
      '',
      `*Patient Info*`,
      `Name: ${lead.patientName}`,
      `Age / Gender: ${lead.age ?? '—'} / ${lead.sex ?? '—'}`,
      `Phone: ${lead.phoneNumber ?? '—'}`,
      lead.attendantName ? `Attendant: ${lead.attendantName}${lead.attendantContactNo ? ` (${lead.attendantContactNo})` : ''}` : null,
      `Circle: ${lead.circle ?? '—'}`,
      '',
      `*Treatment*`,
      `Treatment: ${lead.treatment ?? '—'}`,
      `Category: ${lead.category ?? '—'}`,
      lead.quantityGrade
        ? `${lead.category?.toLowerCase() === 'lipoma' ? 'Count' : 'Grade'}: ${lead.quantityGrade}`
        : null,
      lead.anesthesia ? `Anaesthesia: ${lead.anesthesia}` : null,
      '',
      `*Surgeon*`,
      `Name: ${lead.ipdDrName || preAuthDoctorName || lead.surgeonName || '—'}`,
      lead.surgeonType ? `Type: ${lead.surgeonType}` : null,
      '',
      `*Hospital*`,
      `Hospital: ${rec?.admittingHospital || lead.hospitalName || '—'}`,
      rec?.hospitalAddress ? `Address: ${rec.hospitalAddress}` : null,
      rec?.googleMapLocation ? `Maps: ${rec.googleMapLocation}` : null,
      '',
      ...(isCash ? [
        `*Payment*`,
        `Mode: ${lead.modeOfPayment ?? '—'}`,
        `Approved / Cash Package: ${fmtMoney(approvedAmount)}`,
        `Final Bill Amount: ${fmtMoney(finalBillAmount)}`,
        totalCollectedAmount ? `Cash / Deduction Collected: ${fmtMoney(totalCollectedAmount)}` : null,
        discountAmount ? `Discount: ${fmtMoney(discountAmount)}` : null,
        lead.copay ? `Copay: ${fmtMoney(lead.copay)}` : null,
        deductionAmount ? `Deduction: ${fmtMoney(deductionAmount)}` : null,
        `Collected by Mediend: ${fmtMoney(collectedByMediend)}`,
        `Collected by Hospital: ${fmtMoney(collectedByHospital)}`,
        ...emiItems,
      ] : [
        `*Insurance*`,
        `Company: ${lead.insuranceName ?? '—'}`,
        `Type: ${lead.kypSubmission?.insuranceType ?? lead.insuranceType ?? '—'}`,
        `TPA: ${pre?.tpa || rec?.tpa || '—'}`,
        `Sum Insured: ${fmtMoney(pre?.sumInsured)}`,
        `Copay: ${pre?.copay != null ? `${pre.copay}%` : '—'}`,
        `Capping: ${fmtMoney(pre?.capping)}`,
        `Room Type: ${pre?.requestedRoomType ?? '—'}`,
      ]),
      '',
      rec?.instrument ? `*Instruments:* ${rec.instrument}` : null,
      rec?.implantConsumables ? `*Implants/Consumables:* ${rec.implantConsumables}` : null,
      rec?.notes ? `*Notes:* ${rec.notes}` : null,
      '',
      `*BD*`,
      `BD: ${lead.bd?.name ?? '—'}`,
      lead.bd?.manager?.name ? `BD Manager: ${lead.bd.manager.name}` : null,
    ].filter((l): l is string => l !== null).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      toast.success('IPD details copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  // Cash Flow Permissions
  const canStartCash = !readOnly && user && canStartCashMode(user as any, lead)
  const canRevertCash = !readOnly && user && canRevertCashMode(user as any, lead)
  const canFillIPDCash = !readOnly && user && canFillIPDCashForm(user as any, lead)
  const canFillCashDischargeSheet = !readOnly && user && canFillCashDischarge(user as any, lead)

  // Collect all uploaded documents for grid (KYP + PreAuth)
  const uploadedDocuments = (() => {
    const items: { title: string; url: string; isImage: boolean; documentField?: string; editCount?: number; kypId?: string; isEdited?: boolean }[] = []
    // Prefer the separately fetched kypSubmission as it might have more details (e.g. preAuthData)
    const kyp = kypSubmission || lead?.kypSubmission
    if (!kyp) return items

    const editCounts = ((kyp as any).documentEditCounts as Record<string, number>) || {}

    const add = (title: string, url: string, documentField?: string) => {
      if (!url) return
      const u = url.toLowerCase()
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(u) || u.includes('jpg') || u.includes('png')
      const fieldKey = documentField?.replace(/FileUrl$/, '').replace(/Files$/, '')
      const editCount = fieldKey ? (editCounts[fieldKey] || 0) : 0
      items.push({ title, url, isImage, documentField, editCount, kypId: kyp.id, isEdited: editCount > 0 })
    }

    if (kyp.insuranceCardFileUrl) add('Insurance Card', kyp.insuranceCardFileUrl, 'insuranceCardFileUrl')
    kypMultiDocUrls(kyp.aadharFiles, kyp.aadharFileUrl).forEach((url, i, a) => {
      add(a.length > 1 ? `Aadhaar ${i + 1}` : 'Aadhaar', url, kyp.aadharFiles ? 'aadharFiles' : 'aadharFileUrl')
    })
    kypMultiDocUrls(kyp.panFiles, kyp.panFileUrl).forEach((url, i, a) => {
      add(a.length > 1 ? `PAN ${i + 1}` : 'PAN', url, kyp.panFiles ? 'panFiles' : 'panFileUrl')
    })
    if (kyp.prescriptionFileUrl) add('Prescription', kyp.prescriptionFileUrl, 'prescriptionFileUrl')

    const processFiles = (files: any, typeLabel: string, documentField?: string) => {
      if (!files) return
      const fileList = Array.isArray(files) ? files : []
      fileList.forEach((p: any, index: number) => {
        const url = typeof p === 'string' ? p : p?.url
        if (!url) return
        const title = fileList.length > 1 ? `${typeLabel} ${index + 1}` : typeLabel
        add(title, url, documentField)
      })
    }

    processFiles(kyp.diseasePhotos, 'Disease photo', 'diseasePhotos')
    processFiles(kyp.otherFiles, 'Additional document', 'otherFiles')
    processFiles(kyp.preAuthData?.diseaseImages, 'Disease image')
    processFiles(kyp.preAuthData?.investigationFileUrls, 'Investigation')
    processFiles(kyp.preAuthData?.prescriptionFiles, 'Prescription')

    // Deduplicate items based on URL
    const uniqueItems = items.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.url === item.url
      ))
    )

    return uniqueItems
  })()

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        {/* Professional Header Section */}

        <div className="space-y-6">
          {/* Patient Dossier Card */}
          <Card className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="h-[3px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

            {/* Identity strip */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-900 sm:px-6">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
                  className="-ml-2 mt-0.5 shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-lg font-semibold text-white shadow-sm ring-4 ring-emerald-50 dark:ring-emerald-950/40">
                  {(() => {
                    const parts = (lead.patientName || '')
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                    if (parts.length === 0) return '·'
                    if (parts.length === 1)
                      return (parts[0][0] ?? '·').toUpperCase()
                    return (
                      (parts[0][0] ?? '') +
                      (parts[parts.length - 1][0] ?? '')
                    ).toUpperCase()
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">
                    Patient Dossier · {lead.leadRef}
                  </p>
                  <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl">
                    {lead.patientName}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-600 dark:text-gray-400">
                    <span>
                      {lead.age ?? '—'} / {lead.sex ?? '—'}
                    </span>
                    {lead.profession && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span>{lead.profession}</span>
                      </>
                    )}
                    {lead.phoneNumber && lead.phoneNumber !== '—' && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span className="font-mono text-xs">{lead.phoneNumber}</span>
                      </>
                    )}
                    {lead.status && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{lead.status}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href={`/chat/${leadId}`}>
                    <MessageCircle className="h-4 w-4" />
                    Chat
                  </Link>
                </Button>
                <Badge
                  variant="outline"
                  className="border-gray-300 font-mono text-[10px] uppercase tracking-wider dark:border-gray-700"
                >
                  {lead.pipelineStage}
                </Badge>
                <Badge className={`border-2 ${getStageBadgeColor(lead.caseStage)}`}>
                  {lead.caseStage.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>

            {/* Dossier grid — 4 sections, paper-style dividers via gap-px */}
            {(() => {
              const location =
                lead.kypSubmission?.location?.trim() || lead.circle || null
              const area = lead.kypSubmission?.area?.trim() || null
              const surgeonLine = [lead.surgeonName, lead.surgeonType]
                .filter(Boolean)
                .join(' · ')
              const leadDate = lead.leadEntryDate || lead.createdDate
              const rec = lead.admissionRecord
              const isPostponed = rec?.ipdStatus === 'POSTPONED'
              const effectiveSurgeryDate =
                isPostponed && rec?.newSurgeryDate
                  ? rec.newSurgeryDate
                  : rec?.surgeryDate
              const surgeryDateNode = effectiveSurgeryDate ? (
                <span className="inline-flex items-center gap-1.5">
                  <span>
                    {format(new Date(effectiveSurgeryDate), 'dd MMM yyyy')}
                    {rec?.surgeryTime && !isPostponed ? ` · ${rec.surgeryTime}` : ''}
                  </span>
                  {isPostponed && (
                    <span className="rounded-sm bg-amber-100 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      rescheduled
                    </span>
                  )}
                </span>
              ) : null
              return (
                <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-gray-900 md:grid-cols-3">
                  <dl className="bg-white px-5 py-4 dark:bg-gray-950">
                    <DossierSectionHeader icon={Stethoscope} label="Clinical" />
                    <DossierField icon={Activity} label="Treatment" value={lead.treatment} />
                    <DossierField icon={Tag} label="Category" value={lead.category} />
                    <DossierField icon={User} label="Surgeon" value={surgeonLine || null} />
                    <DossierField icon={Activity} label="Anesthesia" value={lead.anesthesia} />
                    {lead.category?.toLowerCase() === 'lipoma' && (
                      <DossierField icon={Tag} label="Count" value={lead.quantityGrade} />
                    )}
                    {(lead.category?.toLowerCase() === 'gynaecology' || lead.category?.toLowerCase() === 'gynecology') && (
                      <DossierField icon={Tag} label="Grade" value={lead.quantityGrade} />
                    )}
                    <DossierField
                      icon={Stethoscope}
                      label="Disease"
                      value={lead.kypSubmission?.disease}
                    />
                  </dl>
                  <dl className="bg-white px-5 py-4 dark:bg-gray-950">
                    <DossierSectionHeader icon={Building2} label="Hospital & Cover" />
                    <DossierField icon={Building2} label="Hospital" value={resolveLeadHospitalDoctor(lead).hospital} />
                    <DossierField icon={User} label="IPD Doctor" value={lead.ipdDrName} />
                    <DossierField icon={MapPin} label="City" value={location} />
                    <DossierField icon={MapPin} label="Area" value={area} />
                    <DossierField icon={Shield} label="Insurance" value={lead.insuranceName} />
                    <DossierField icon={Shield} label="Type" value={lead.insuranceType} />
                  </dl>
                  <dl className="bg-white px-5 py-4 dark:bg-gray-950">
                    <DossierSectionHeader icon={CalendarIcon} label="Team & Timeline" />
                    <DossierField icon={User} label="BD" value={lead.bd?.name} />
                    <DossierField
                      icon={User}
                      label="Manager"
                      value={lead.bd?.manager?.name}
                    />
                    <DossierField
                      icon={CalendarIcon}
                      label="Lead Date"
                      value={
                        leadDate ? format(new Date(leadDate), 'dd MMM yyyy') : null
                      }
                      mono
                    />
                    <DossierField
                      icon={CalendarIcon}
                      label="Assigned"
                      value={
                        lead.assignedDate
                          ? format(new Date(lead.assignedDate), 'dd MMM yyyy')
                          : null
                      }
                      mono
                    />
                    <DossierField
                      icon={CalendarIcon}
                      label="Surgery"
                      value={surgeryDateNode}
                      mono
                    />
                    <DossierField
                      icon={CalendarIcon}
                      label="Admission"
                      value={
                        rec?.admissionDate
                          ? `${format(new Date(rec.admissionDate), 'dd MMM yyyy')}${rec.admissionTime ? ` · ${rec.admissionTime}` : ''}`
                          : null
                      }
                      mono
                    />
                    <DossierField
                      icon={CalendarIcon}
                      label="Discharge"
                      value={
                        rec?.ipdDischargeDate
                          ? format(new Date(rec.ipdDischargeDate), 'dd MMM yyyy')
                          : null
                      }
                      mono
                    />
                  </dl>
                </div>
              )
            })()}
          </Card>

          {/* Surgery / IPD status banner — updates when postponed, cancelled, or discharged */}
          {lead.admissionRecord && (() => {
            const rec = lead.admissionRecord
            const status = rec.ipdStatus

            if (status === 'CANCELLED') {
              return (
                <Card className="border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                        <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">Surgery cancelled</p>
                        {rec.ipdStatusReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{rec.ipdStatusReason}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            if (status === 'ADMITTED_DONE') {
              const admitStr = rec.admissionDate
                ? format(new Date(rec.admissionDate), 'dd MMM yyyy')
                : '—'
              return (
                <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                        <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Patient admitted{admitStr !== '—' ? ` — ${admitStr}` : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            if (status === 'IPD_DONE') {
              const surgeryStr = rec.surgeryDate
                ? `${format(new Date(rec.surgeryDate), 'dd MMM yyyy')}${rec.surgeryTime ? ` at ${rec.surgeryTime}` : ''}`
                : '—'
              return (
                <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                        <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                          Surgery completed — {surgeryStr}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            if (status === 'DISCHARGED') {
              const dischargeStr = rec.ipdDischargeDate
                ? format(new Date(rec.ipdDischargeDate), 'EEEE, dd MMM yyyy')
                : '—'
              return (
                <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                        <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                          Discharged on {dischargeStr}
                        </p>
                        {rec.ipdStatusReason && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{rec.ipdStatusReason}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            const effectiveDate = (status === 'POSTPONED' && rec.newSurgeryDate) ? rec.newSurgeryDate : rec.surgeryDate
            const surgeryTime = rec.surgeryTime ?? ''
            if (!effectiveDate) return null
            let surgeryDateTime: Date
            try {
              surgeryDateTime = new Date(effectiveDate)
              if (surgeryTime && status !== 'POSTPONED') {
                const [h, m] = surgeryTime.trim().split(/[:\s]/).map(Number)
                if (!isNaN(h)) surgeryDateTime.setHours(isNaN(m) ? h : h, isNaN(m) ? 0 : m, 0, 0)
              }
            } catch {
              return null
            }
            const now = new Date()
            const isPast = surgeryDateTime.getTime() < now.getTime()
            const countdown = isPast
              ? `Was ${format(surgeryDateTime, 'dd MMM yyyy')}${surgeryTime && status !== 'POSTPONED' ? ` at ${surgeryTime}` : ''}`
              : `in ${formatDistanceToNow(surgeryDateTime, { addSuffix: false })}`
            const isRescheduled = status === 'POSTPONED'
            return (
              <Card className="border-2 border-teal-200 dark:border-teal-800 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                      <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                        {isRescheduled ? 'Surgery rescheduled' : isPast ? 'Surgery was scheduled' : 'Surgery scheduled'} — {format(surgeryDateTime, 'EEEE, dd MMM yyyy')}
                        {surgeryTime && status !== 'POSTPONED' ? ` at ${surgeryTime}` : ''}
                      </p>
                      <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
                        {isPast ? countdown : `${countdown} from now`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Compact Stage Progress */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                {lead.flowType === FlowType.CASH ? 'Cash Flow Progress' : 'Case Progress'}
              </p>
              {lead.flowType === FlowType.CASH && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Cash Mode
                </Badge>
              )}
            </div>
            {lead.flowType === FlowType.CASH ? (
              <CashStageProgress currentStage={lead.caseStage} />
            ) : (
              <StageProgress
                currentStage={lead.caseStage}
                hasInitiateForm={!!lead.insuranceInitiateForm?.id}
                hasIpdMark={!!lead.admissionRecord?.ipdStatus}
              />
            )}
          </div>
        </div>


        {/* Uploaded Documents Grid */}
        {uploadedDocuments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {uploadedDocuments.map((doc, index) => {
              const isBd = user?.role === 'BD'
              const canEdit = isBd && doc.documentField && doc.kypId && (doc.editCount ?? 0) < 1
              const remainingEdits = 1 - (doc.editCount ?? 0)

              return (
                <div
                  key={`${doc.url}-${index}`}
                  className={cn(
                    "flex flex-col rounded-lg border-2 overflow-hidden hover:shadow-md transition-all",
                    doc.isEdited
                      ? "border-amber-300 dark:border-amber-700"
                      : "border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600"
                  )}
                >
                  <div className="w-full h-[200px] shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center relative">
                    {doc.isEdited && (
                      <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        <Pencil className="w-2.5 h-2.5" /> Edited ({doc.editCount}x)
                      </span>
                    )}
                    {doc.isImage ? (
                      <iframe
                        src={doc.url}
                        title={doc.title}
                        className="w-full h-full border-0 pointer-events-none select-none"
                        style={{ overflow: 'hidden' }}
                      />
                    ) : (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-4 no-underline"
                      >
                        <FileText className="w-12 h-12" />
                        <span className="text-xs text-center line-clamp-2">{doc.title}</span>
                        <span className="text-xs font-medium">Open in new tab</span>
                      </a>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={doc.title}>
                      {doc.title}
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                      {canEdit && (
                        <label className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer">
                          <Pencil className="h-3 w-3" />
                          Edit ({remainingEdits} left)
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              try {
                                const formData = new FormData()
                                formData.append('file', file)
                                formData.append('folder', 'kyp')
                                const uploadRes = await fetch('/api/kyp/upload', {
                                  method: 'POST',
                                  body: formData,
                                  credentials: 'include',
                                })
                                const uploadData = await uploadRes.json()
                                if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed')

                                const fileUrl = uploadData.data?.url || uploadData.url
                                const isJsonField = ['aadharFiles', 'panFiles', 'diseasePhotos', 'otherFiles'].includes(doc.documentField!)
                                const editBody: Record<string, unknown> = { documentField: doc.documentField }
                                if (isJsonField) {
                                  editBody.newFiles = [{ name: file.name, url: fileUrl }]
                                } else {
                                  editBody.newFileUrl = fileUrl
                                }

                                const editRes = await fetch(`/api/kyp/${doc.kypId}/edit-document`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(editBody),
                                  credentials: 'include',
                                })
                                const editData = await editRes.json()
                                if (!editRes.ok) throw new Error(editData.error || 'Edit failed')

                                toast.success(`Document updated (${editData.data?.remainingEdits ?? 0} edits remaining)`)
                                queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                                queryClient.invalidateQueries({ queryKey: ['kyp-submission', leadId] })
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Failed to edit document')
                              }
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Action Buttons Section */}
        {user && (
          <Card className="border-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Actions</CardTitle>
              <CardDescription>Available actions based on case stage and your role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {/* Cash Flow Actions */}
                {canStartCash && (
                  <Button
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-0"
                    disabled={switchingMode}
                    onClick={async () => {
                      if (!confirm('Are you sure you want to switch to Cash Mode? This will change the workflow.')) return
                      setSwitchingMode(true)
                      try {
                        await apiPatch(`/api/leads/${leadId}`, {
                          flowType: FlowType.CASH,
                          caseStage: CaseStage.CASH_IPD_PENDING,
                          stageChangeNote: 'Switched to Cash Mode'
                        })
                        toast.success('Switched to Cash Mode')
                        queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                      } catch (e) {
                        toast.error('Failed to switch mode')
                      } finally {
                        setSwitchingMode(false)
                      }
                    }}
                  >
                    {switchingMode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Start Cash Mode
                  </Button>
                )}

                {canRevertCash && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={switchingMode}
                    onClick={async () => {
                      if (!confirm('Switch back to Insurance Flow?')) return
                      setSwitchingMode(true)
                      try {
                        // Revert to previous stage logic is complex, for now revert to NEW_LEAD or KYP_BASIC_COMPLETE?
                        // Or just set flowType to INSURANCE and let stage be what it was?
                        // Ideally we should track previous stage.
                        // For simplicity, let's set to KYP_BASIC_COMPLETE if kyp exists, else NEW_LEAD.
                        const targetStage = lead.kypSubmission ? CaseStage.KYP_BASIC_COMPLETE : CaseStage.NEW_LEAD
                        await apiPatch(`/api/leads/${leadId}`, {
                          flowType: FlowType.INSURANCE,
                          caseStage: targetStage,
                          stageChangeNote: 'Reverted to Insurance Flow'
                        })
                        toast.success('Reverted to Insurance Flow')
                        queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                      } catch (e) {
                        toast.error('Failed to revert mode')
                      } finally {
                        setSwitchingMode(false)
                      }
                    }}
                  >
                    {switchingMode ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Switch to Insurance Flow
                  </Button>
                )}

                {canFillIPDCash && (
                  <Button
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                    onClick={() => setShowIPDCashModal(true)}
                  >
                    <FileText className="h-4 w-4" />
                    {lead.admissionRecord ? 'Edit IPD Cash Form' : 'Fill IPD Cash Form'}
                  </Button>
                )}

                {canFillCashDischargeSheet && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/discharge-cash`}>
                      <Receipt className="h-4 w-4" />
                      Fill Discharge Form
                    </Link>
                  </Button>
                )}

                {/* BD / TL Actions (Insurance Flow) — show when at Card Details step (NEW_LEAD or KYP_BASIC_PENDING) */}
                {lead.flowType !== FlowType.CASH && (user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN') && (lead.caseStage === CaseStage.NEW_LEAD || lead.caseStage === CaseStage.KYP_BASIC_PENDING) && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/kyp/basic`}>
                      <Plus className="h-4 w-4" />
                      Fill Card Details
                    </Link>
                  </Button>
                )}
                {lead.flowType !== FlowType.CASH && (user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN') && lead.caseStage === CaseStage.KYP_BASIC_COMPLETE && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/kyp/basic`}>
                      <Pencil className="h-4 w-4" />
                      Edit Card Details
                    </Link>
                  </Button>
                )}
                {canRaise && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/raise-preauth`}>
                      <FileText className="h-4 w-4" />
                      Raise Pre-Auth
                    </Link>
                  </Button>
                )}
                {canInit && (
                  <Button
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-0"
                    onClick={() => { setAdmitEditMode(false); setShowAdmitModal(true) }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    IPD Scheduled
                  </Button>
                )}
                {canEditIPD && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => { setAdmitEditMode(true); setShowAdmitModal(true) }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit IPD Details
                  </Button>
                )}
                {canMarkIPDStatus && (
                  <Button
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white border-0"
                    onClick={() => setShowIPDMarkModal(true)}
                  >
                    <Activity className="h-4 w-4" />
                    Update IPD Status
                  </Button>
                )}

                {/* Insurance: Suggest hospitals (when KYP Basic just submitted – KYP_BASIC_COMPLETE) */}
                {showSuggestHospitals && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/pre-auth`}>
                      <Shield className="h-4 w-4" />
                      Suggest hospitals
                    </Link>
                  </Button>
                )}
                {/* Insurance: Modify hospital suggestions (when hospitals have been suggested) */}
                {showModifyHospitals && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/pre-auth`}>
                      <Shield className="h-4 w-4" />
                      Modify Hospital Suggestions
                    </Link>
                  </Button>
                )}
                {canAddDetails && !showSuggestHospitals && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/pre-auth`}>
                      <Plus className="h-4 w-4" />
                      Add KYP Details
                    </Link>
                  </Button>
                )}
                {canComplete && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/pre-auth`}>
                      <CheckCircle2 className="h-4 w-4" />
                      Complete Pre-Auth
                    </Link>
                  </Button>
                )}
                {canFillInitiate && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/pre-auth?initiate=true`}>
                      <FileText className="h-4 w-4" />
                      {isInitiateFormFilled ? 'View Initial Form' : 'Fill Initial Form'}
                    </Link>
                  </Button>
                )}
                {canPDF && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-2"
                    onClick={() => window.open(`/api/leads/${leadId}/preauth-pdf`, '_blank', 'noopener,noreferrer')}
                  >
                    <FileDown className="h-4 w-4" />
                    Print / Save as PDF
                  </Button>
                )}
                {lead.admissionRecord && ['BD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role) && (
                  <>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-2"
                      onClick={() => window.open(`/patient/${leadId}/print/ipd`, '_blank', 'noopener,noreferrer')}
                    >
                      <FileDown className="h-4 w-4" />
                      Print IPD
                    </Button>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 border-2 border-green-200 text-green-700 dark:text-green-400"
                      onClick={copyIPDDetailsToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                      Copy IPD
                    </Button>
                  </>
                )}
                {canFillDischargeForm && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/discharge`}>
                      <Receipt className="h-4 w-4" />
                      {lead.dischargeSheet ? 'View Discharge Sheet' : 'Fill Discharge Form'}
                    </Link>
                  </Button>
                )}
                {isDischargeBlocked && (
                  <div className="flex items-center gap-2">
                    <Button
                      disabled
                      className="flex items-center gap-2 bg-gray-400 dark:bg-gray-600 text-white border-0 cursor-not-allowed"
                      title="You must fill the Insurance Initial Form (from the Pre-Auth page) before you can fill the discharge form."
                    >
                      <Receipt className="h-4 w-4" />
                      Fill Discharge Form
                    </Button>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      ⚠ Fill the Initial Form first
                    </span>
                  </div>
                )}
                {showMarkLost && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    onClick={() => setShowMarkLostDialog(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Lost
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KYP Details Section */}
        {kypSubmission && (
          <Card className="border-2 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <CardTitle>KYP Details</CardTitle>
                  {getStatusBadge(kypSubmission.status)}
                  {/* Case stage status chip */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/30 border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-400">
                    <Activity className="w-3 h-3" />
                    {lead.caseStage.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Submitted by <span className="font-semibold">{kypSubmission.submittedBy?.name ?? 'Unknown'}</span> on {format(new Date(kypSubmission.submittedAt), 'PPp')}
                </div>
              </div>
              {/* Follow-up / KYP status details row */}
              {kypSubmission.followUpData && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400 border-t border-green-100 dark:border-green-900/30 pt-3">
                  {kypSubmission.followUpData.admissionDate && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-teal-500" />
                      Admission: <strong>{format(new Date(kypSubmission.followUpData.admissionDate), 'dd MMM yyyy')}</strong>
                    </span>
                  )}
                  {kypSubmission.followUpData.surgeryDate && (
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-purple-500" />
                      Surgery: <strong>{format(new Date(kypSubmission.followUpData.surgeryDate), 'dd MMM yyyy')}</strong>
                    </span>
                  )}
                  {kypSubmission.followUpData.hospitalName && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-500" />
                      {kypSubmission.followUpData.hospitalName}
                    </span>
                  )}
                  {kypSubmission.followUpData.doctorName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-indigo-500" />
                      Dr. {kypSubmission.followUpData.doctorName}
                    </span>
                  )}
                  {kypSubmission.followUpData.updatedAt && (
                    <span className="ml-auto flex items-center gap-1 text-gray-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Updated {format(new Date(kypSubmission.followUpData.updatedAt), 'dd MMM, HH:mm')}
                    </span>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Personal & ID Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <User className="w-4 h-4 text-blue-600" />
                    Personal & ID Details
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Aadhar Number</Label>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-semibold">{kypSubmission.aadhar || '-'}</p>
                        <div className="flex flex-col items-end gap-1">
                          {kypMultiDocList(kypSubmission.aadharFiles, kypSubmission.aadharFileUrl).map(
                            (doc, i, list) => (
                              <Button
                                key={doc.url}
                                asChild
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-blue-600"
                              >
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  {list.length > 1 ? doc.name || `Part ${i + 1}` : 'View'}
                                </a>
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">PAN Number</Label>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-semibold">{kypSubmission.pan || '-'}</p>
                        <div className="flex flex-col items-end gap-1">
                          {kypMultiDocList(kypSubmission.panFiles, kypSubmission.panFileUrl).map(
                            (doc, i, list) => (
                              <Button
                                key={doc.url}
                                asChild
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-blue-600"
                              >
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  {list.length > 1 ? doc.name || `Part ${i + 1}` : 'View'}
                                </a>
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insurance & Medical */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Shield className="w-4 h-4 text-purple-600" />
                    Insurance & Medical
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Insurance Policy</Label>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-semibold">{kypSubmission.insuranceCard || lead.insuranceName || '-'}</p>
                        {kypSubmission.insuranceCardFileUrl && (
                          <Button asChild variant="link" size="sm" className="h-auto p-0 text-blue-600">
                            <a href={kypSubmission.insuranceCardFileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 mr-1" /> View
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Suggested Doctor by BD</Label>
                      <p className="text-sm font-semibold mt-1">{lead.ipdDrName || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Location & Case */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    Location & Case
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Location (City/Area)</Label>
                      <p className="text-sm font-semibold mt-1">
                        {kypSubmission.location || lead.circle}{kypSubmission.area ? `, ${kypSubmission.area}` : ''}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Treatment/Disease</Label>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm font-semibold">{kypSubmission.disease || lead.treatment || '-'}</p>
                        {kypSubmission.prescriptionFileUrl && (
                          <Button asChild variant="link" size="sm" className="h-auto p-0 text-blue-600">
                            <a href={kypSubmission.prescriptionFileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 mr-1" /> Rx
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Files & Remarks */}
              {(kypSubmission.remark || (kypSubmission.otherFiles && kypSubmission.otherFiles.length > 0) || (kypSubmission.diseasePhotos && kypSubmission.diseasePhotos.length > 0)) && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {kypSubmission.remark && (
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Remarks</Label>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 bg-amber-50/30 dark:bg-amber-950/10 p-3 rounded-lg border border-amber-100/50 dark:border-amber-900/20 italic">
                          &quot;{kypSubmission.remark}&quot;
                        </p>
                      </div>
                    )}
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Additional Documents</Label>
                      <div className="flex flex-wrap gap-2">
                        {kypSubmission.diseasePhotos?.map((p, i) => (
                          <Button key={i} asChild variant="outline" size="sm" className="h-8 text-[11px] gap-1">
                            <a href={p.url} target="_blank" rel="noopener noreferrer">
                              <File className="w-3 h-3" /> {p.name || `Photo ${i+1}`}
                            </a>
                          </Button>
                        ))}
                        {kypSubmission.otherFiles?.map((f, i) => (
                          <Button key={i} asChild variant="outline" size="sm" className="h-8 text-[11px] gap-1">
                            <a href={f.url} target="_blank" rel="noopener noreferrer">
                              <File className="w-3 h-3" /> {f.name || `Doc ${i+1}`}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Insurance & Pre-Auth Details Section */}
        {kypSubmission?.preAuthData && (
          <Card className="border-2 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Insurance & Pre-Auth Details</CardTitle>
                  {kypSubmission.preAuthData.approvalStatus && (
                    <Badge className={cn(
                      "border-0",
                      kypSubmission.preAuthData.approvalStatus === 'APPROVED' ? "bg-green-100 text-green-700" :
                        kypSubmission.preAuthData.approvalStatus === 'REJECTED' ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                    )}>
                      {kypSubmission.preAuthData.approvalStatus}
                    </Badge>
                  )}
                </div>
                {kypSubmission.preAuthData.handledAt && (
                  <div className="text-xs text-muted-foreground">
                    Processed by <span className="font-semibold">{kypSubmission.preAuthData.handledBy?.name || 'Insurance Team'}</span> on {format(new Date(kypSubmission.preAuthData.handledAt), 'PPp')}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Policy Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Policy Information
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Insurance Co.</Label>
                        <p className="text-sm font-semibold">{kypSubmission.preAuthData.insurance || lead.insuranceName || kypSubmission.insuranceCard || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">TPA</Label>
                        <p className="text-sm font-semibold">{kypSubmission.preAuthData.tpa || '-'}</p>
                      </div>
                      {kypSubmission.insuranceCardFileUrl && (
                        <div className="col-span-2">
                          <Label className="text-[10px] uppercase text-gray-500 font-bold">Insurance Card (file)</Label>
                          <p className="text-sm font-semibold">
                            <a href={kypSubmission.insuranceCardFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block">
                              {kypSubmission.insuranceCardFileUrl}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Sum Insured</Label>
                        <p className="text-sm font-semibold">₹{Number(kypSubmission.preAuthData.sumInsured || 0).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Balance Insured</Label>
                        <p className="text-sm font-semibold">₹{Number(kypSubmission.preAuthData.balanceInsured || 0).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Co-pay %</Label>
                        <p className="text-sm font-semibold">{kypSubmission.preAuthData.copay || '0'}%</p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Disease Capping</Label>
                        <p className="text-sm font-semibold">
                          {kypSubmission.preAuthData.capping != null && kypSubmission.preAuthData.capping !== ''
                            ? (typeof kypSubmission.preAuthData.capping === 'string' && !Number.isNaN(Number(kypSubmission.preAuthData.capping))
                              ? `₹${Number(kypSubmission.preAuthData.capping).toLocaleString('en-IN')}`
                              : String(kypSubmission.preAuthData.capping))
                            : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selection & Request */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Selected Request
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label className="text-[10px] uppercase text-gray-500 font-bold">Selected Hospital</Label>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{kypSubmission.preAuthData.requestedHospitalName || '-'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Room Category</Label>
                        <p className="text-sm font-semibold">{kypSubmission.preAuthData.requestedRoomType || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Room Rent (selected)</Label>
                        <p className="text-sm font-semibold">
                          {(() => {
                            const requestedName = kypSubmission.preAuthData.requestedHospitalName?.trim()
                            const requestedRoom = (kypSubmission.preAuthData.requestedRoomType || '').toLowerCase().replace(/\s+/g, ' ')
                            const selectedHosp = requestedName && kypSubmission.preAuthData.suggestedHospitals?.length
                              ? kypSubmission.preAuthData.suggestedHospitals.find((h) => h.hospitalName?.trim() === requestedName)
                              : null
                            const rent = selectedHosp
                              ? (requestedRoom.includes('single') && selectedHosp.roomRentSingle != null ? selectedHosp.roomRentSingle
                                : (requestedRoom.includes('semi') || requestedRoom.includes('private')) && selectedHosp.roomRentSemiPrivate != null ? selectedHosp.roomRentSemiPrivate
                                  : requestedRoom.includes('deluxe') && selectedHosp.roomRentDeluxe != null ? selectedHosp.roomRentDeluxe
                                    : requestedRoom.includes('general') && selectedHosp.roomRentGeneral != null ? selectedHosp.roomRentGeneral
                                      : selectedHosp.roomRentSingle ?? selectedHosp.roomRentSemiPrivate ?? selectedHosp.roomRentDeluxe ?? selectedHosp.roomRentGeneral ?? null)
                              : null
                            return rent != null ? `₹${Number(rent).toLocaleString('en-IN')}` : '-'
                          })()}
                        </p>
                      </div>
                    </div>
                    {kypSubmission.preAuthData.preAuthRaisedAt && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Raised On</Label>
                        <p className="text-sm font-semibold">{format(new Date(kypSubmission.preAuthData.preAuthRaisedAt), 'PPp')}</p>
                        <p className="text-[10px] text-muted-foreground">By {kypSubmission.preAuthData.preAuthRaisedBy?.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hospital Suggestions */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300 border-b pb-2">
                    <Building2 className="w-4 h-4 text-amber-600" />
                    All Suggestions
                  </h3>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                    {kypSubmission.preAuthData.suggestedHospitals && kypSubmission.preAuthData.suggestedHospitals.length > 0 ? (
                      kypSubmission.preAuthData.suggestedHospitals.map((hosp, idx) => (
                        <div key={hosp.id} className={cn(
                          "p-2 rounded border text-xs space-y-1",
                          hosp.hospitalName === kypSubmission.preAuthData?.requestedHospitalName
                            ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-500"
                            : "bg-gray-50 border-gray-100 dark:bg-gray-900 dark:border-gray-800"
                        )}>
                          <div className="flex justify-between font-bold">
                            <span className="truncate pr-2">{hosp.hospitalName}</span>
                            <span className="text-blue-600 dark:text-blue-400 shrink-0">₹{Number(hosp.tentativeBill || 0).toLocaleString('en-IN')}</span>
                          </div>
                          {hosp.suggestedDoctor && (
                            <div className="text-muted-foreground">{hosp.suggestedDoctor}</div>
                          )}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                            {hosp.roomRentSingle && <span>Sgl: ₹{hosp.roomRentSingle}</span>}
                            {hosp.roomRentSemiPrivate && <span>Semi: ₹{hosp.roomRentSemiPrivate}</span>}
                            {hosp.roomRentDeluxe && <span>Dlx: ₹{hosp.roomRentDeluxe}</span>}
                            {hosp.roomRentGeneral && <span>Gen: ₹{hosp.roomRentGeneral}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No suggestions provided yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Remarks & Notes */}
              {(kypSubmission.preAuthData.approvalNotes || kypSubmission.preAuthData.rejectionReason || kypSubmission.preAuthData.diseaseDescription) && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {kypSubmission.preAuthData.diseaseDescription && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Disease Description (from BD)</Label>
                        <p className="text-sm mt-1 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                          {kypSubmission.preAuthData.diseaseDescription}
                        </p>
                      </div>
                    )}
                    {(kypSubmission.preAuthData.approvalNotes || kypSubmission.preAuthData.rejectionReason) && (
                      <div>
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">
                          {kypSubmission.preAuthData.approvalStatus === 'REJECTED' ? 'Rejection Reason' : 'Insurance Remarks'}
                        </Label>
                        <p className={cn(
                          "text-sm mt-1 p-3 rounded-lg border italic",
                          kypSubmission.preAuthData.approvalStatus === 'REJECTED'
                            ? "bg-red-50 border-red-100 text-red-700 dark:bg-red-950/10 dark:border-red-900/20"
                            : "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/10 dark:border-amber-900/20"
                        )}>
                          &quot;{kypSubmission.preAuthData.rejectionReason || kypSubmission.preAuthData.approvalNotes}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Initiate Form Details */}
        {initiateFormData?.initiateForm && canViewInitiateForm(user as any, lead) && (
          <InitiateFormCard initiateForm={initiateFormData.initiateForm} />
        )}

        {/* IPD Details Section */}
        {lead.admissionRecord && (
          <IPDDetailsCard admissionRecord={lead.admissionRecord} lead={lead} />
        )}

        {/* Discharge & patient info — inline read-only panel, hidden from BD and TL */}
        {lead.dischargeSheet && user?.role !== 'BD' && user?.role !== 'TEAM_LEAD' && (
          <Card>
            <CardHeader>
              <CardTitle>Discharge</CardTitle>
              <CardDescription>Patient discharge information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PatientDischargeInfo leadId={leadId} lead={lead} />
              <Button asChild variant="outline">
                <Link href={lead.flowType === FlowType.CASH ? `/patient/${leadId}/discharge-cash` : `/patient/${leadId}/discharge`}>
                  <Receipt className="h-4 w-4 mr-2" />
                  {canFillDischargeForm ? 'Open Discharge Form' : 'View Discharge Sheet'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Activity Timeline */}
        {stageHistory && <ActivityTimeline history={stageHistory} />}

        {/* Mark Admitted Modal — Full IPD Details Form */}
        <Dialog open={showAdmitModal} onOpenChange={setShowAdmitModal}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{admitEditMode ? 'Edit IPD Details' : 'Step 6: IPD Details'}</DialogTitle>
              <DialogDescription>
                {admitEditMode
                  ? 'Update the saved admission details. Allowed until IPD Done is marked.'
                  : 'Fill all admission details. Insurance will be notified once saved.'}
              </DialogDescription>
            </DialogHeader>
            {lead && (
              <IPDDetailsForm
                leadId={leadId}
                patientName={lead.patientName}
                leadRef={lead.leadRef}
                age={lead.age}
                sex={lead.sex}
                phoneNumber={lead.phoneNumber}
                alternateNumber={lead.alternateNumber ?? undefined}
                attendantName={lead.attendantName ?? undefined}
                attendantContactNo={lead.attendantContactNo ?? undefined}
                circle={lead.circle}
                category={lead.category ?? undefined}
                treatment={lead.treatment ?? undefined}
                quantityGrade={lead.quantityGrade ?? undefined}
                anesthesia={lead.anesthesia ?? undefined}
                surgeonName={lead.ipdDrName || lead.surgeonName || lead.kypSubmission?.preAuthData?.suggestedHospitals?.find(h => h.hospitalName?.trim() === lead.kypSubmission?.preAuthData?.requestedHospitalName?.trim())?.suggestedDoctor || undefined}
                surgeonType={lead.surgeonType ?? undefined}
                hospitalName={(lead.hospitalName && lead.hospitalName !== 'Not Specified' ? lead.hospitalName : null) || lead.kypSubmission?.preAuthData?.requestedHospitalName || undefined}
                insuranceName={lead.insuranceName ?? undefined}
                insuranceType={lead.kypSubmission?.insuranceType ?? lead.insuranceType ?? undefined}
                tpa={lead.kypSubmission?.preAuthData?.tpa ?? undefined}
                sumInsured={lead.kypSubmission?.preAuthData?.sumInsured ?? undefined}
                copay={lead.kypSubmission?.preAuthData?.copay ?? undefined}
                capping={lead.kypSubmission?.preAuthData?.capping ?? undefined}
                roomType={lead.kypSubmission?.preAuthData?.requestedRoomType ?? undefined}
                roomRent={roomRentFromPreAuth ?? lead.kypSubmission?.preAuthData?.roomRent ?? undefined}
                bdName={lead.bd?.name}
                bdManagerName={lead.bd?.manager?.name ?? undefined}
                isEditMode={admitEditMode}
                initialData={lead.admissionRecord ?? undefined}
                onSuccess={() => {
                  setShowAdmitModal(false)
                  queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                  queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
                }}
                onCancel={() => setShowAdmitModal(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* IPD Cash Form Modal */}
        <Dialog open={showIPDCashModal} onOpenChange={setShowIPDCashModal}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>IPD Cash Details</DialogTitle>
              <DialogDescription>
                Fill admission and payment details for Cash Flow.
              </DialogDescription>
            </DialogHeader>
            {lead && (
              <IPDCashForm
                leadId={leadId}
                patientName={lead.patientName}
                leadRef={lead.leadRef}
                age={lead.age}
                sex={lead.sex}
                phoneNumber={lead.phoneNumber}
                alternateNumber={lead.alternateNumber ?? undefined}
                attendantName={lead.attendantName ?? undefined}
                attendantContactNo={lead.attendantContactNo ?? undefined}
                circle={lead.circle}
                category={lead.category ?? undefined}
                treatment={lead.treatment ?? undefined}
                quantityGrade={lead.quantityGrade ?? undefined}
                anesthesia={lead.anesthesia ?? undefined}
                surgeonName={lead.ipdDrName || lead.surgeonName || lead.kypSubmission?.preAuthData?.suggestedHospitals?.find(h => h.hospitalName?.trim() === lead.kypSubmission?.preAuthData?.requestedHospitalName?.trim())?.suggestedDoctor || undefined}
                surgeonType={lead.surgeonType ?? undefined}
                hospitalName={(lead.hospitalName && lead.hospitalName !== 'Not Specified' ? lead.hospitalName : null) || lead.kypSubmission?.preAuthData?.requestedHospitalName || undefined}
                bdName={lead.bd?.name}
                bdManagerName={lead.bd?.manager?.name ?? undefined}
                // Pass existing data if editing (admissionRecord + lead financials for collected amounts)
                initialData={lead.admissionRecord ? {
                  ...lead.admissionRecord,
                  modeOfPayment: lead.modeOfPayment,
                  approvedAmount: (lead.settledTotal ?? 0) > 0 ? lead.settledTotal : lead.dischargeSheet?.settlementPart,
                  finalBillAmount: (lead.billAmount ?? 0) > 0 ? lead.billAmount : lead.dischargeSheet?.billAmount,
                  collectedAmount: extractLatestAmountFromRemarks(lead.remarks, 'Collected'),
                  collectedByMediend: (lead.collectedByMediend ?? 0) > 0 ? lead.collectedByMediend : lead.dischargeSheet?.collectedByMediend,
                  collectedByHospital: (lead.collectedByHospital ?? 0) > 0 ? lead.collectedByHospital : lead.dischargeSheet?.collectedByHospital,
                  discount: (lead.discount ?? 0) > 0 ? lead.discount : lead.dischargeSheet?.discountAmount,
                  copay: lead.copay,
                  deduction: (lead.deduction ?? 0) > 0 ? lead.deduction : lead.dischargeSheet?.deductionAmount,
                } : undefined}
                isEditMode={!!lead.admissionRecord}
                onSuccess={() => {
                  setShowIPDCashModal(false)
                  queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                }}
                onCancel={() => setShowIPDCashModal(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* IPD Mark Modal */}
        <Dialog open={showIPDMarkModal} onOpenChange={setShowIPDMarkModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Update IPD Status</DialogTitle>
              <DialogDescription>
                Update the current status of the patient in IPD.
              </DialogDescription>
            </DialogHeader>
            <IPDMarkComponent
              leadId={leadId}
              defaultSurgeryDate={lead.admissionRecord?.surgeryDate ?? lead.surgeryDate ?? null}
              onSuccess={() => {
                setShowIPDMarkModal(false)
                queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                queryClient.invalidateQueries({ queryKey: ['leads', 'insurance'] })
              }}
              onCancel={() => setShowIPDMarkModal(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showMarkLostDialog} onOpenChange={setShowMarkLostDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Case as Lost</DialogTitle>
              <DialogDescription>
                Provide a reason. This will move the case to the Lost pipeline stage.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="markLostReason">Reason *</Label>
                <select
                  id="markLostReason"
                  value={markLostReason}
                  onChange={(e) => setMarkLostReason(e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select reason</option>
                  <option value="Patient Declined">Patient Declined</option>
                  <option value="Ghosted">Ghosted</option>
                  <option value="Financial Issue">Financial Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="markLostDetail">Additional details (optional)</Label>
                <Textarea
                  id="markLostDetail"
                  value={markLostDetail}
                  onChange={(e) => setMarkLostDetail(e.target.value)}
                  placeholder="Any additional context"
                  className="mt-2 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMarkLostDialog(false)
                    setMarkLostReason('')
                    setMarkLostDetail('')
                  }}
                  disabled={markLostSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={!markLostReason || markLostSubmitting}
                  onClick={async () => {
                    setMarkLostSubmitting(true)
                    try {
                      await apiPost(`/api/leads/${leadId}/mark-lost`, {
                        lostReason: markLostReason,
                        lostReasonDetail: markLostDetail.trim() || undefined,
                      })
                      toast.success('Case marked as lost')
                      setShowMarkLostDialog(false)
                      setMarkLostReason('')
                      setMarkLostDetail('')
                      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                      queryClient.invalidateQueries({ queryKey: ['case-chat', leadId] })
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to mark as lost')
                    } finally {
                      setMarkLostSubmitting(false)
                    }
                  }}
                >
                  {markLostSubmitting ? 'Saving...' : 'Mark Lost'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  )
}
