'use client'

import { IPDCashForm } from '@/components/admission/ipd-cash-form'
import { IPDDetailsCard } from '@/components/admission/ipd-details-card'
import { IPDDetailsForm } from '@/components/admission/ipd-details-form'
import { IPDMarkComponent } from '@/components/admission/ipd-mark-component'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { LeadEditDrawer } from '@/components/pipeline/lead-edit-drawer'
import { PatientDischargeInfo } from '@/components/discharge/patient-discharge-info'
import { InitiateFormCard } from '@/components/insurance/initiate-form-card'
import { LeadQrPopover } from '@/components/leads/lead-qr-popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { hrefWithReturnTo, resolveReturnTo } from '@/lib/navigation/return-to'
import { normalizeModeOfPaymentKey, normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, ArrowRight, Building2, Calendar as CalendarIcon, CheckCircle2, Clock, Copy, ExternalLink, File, FileDown, FileText, MapPin, MessageCircle, Pencil, PhoneCall, Plus, Receipt, RefreshCw, RotateCcw, Shield, Stethoscope, Tag, User, Wallet, XCircle } from 'lucide-react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { ActivityTimeline } from '@/components/case/activity-timeline'
import { KnowlarityCallRecordingsCard } from '@/components/telephony/knowlarity-call-recordings-card'
import { CashStageProgress } from '@/components/case/cash-stage-progress'
import { ResetStepperDialog } from '@/components/case/reset-stepper-dialog'
import { StageProgress } from '@/components/case/stage-progress'
import { Field, Section } from '@/components/patient/details-section'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CaseStage, FlowType, LeadOpdPhase, LeadOpdStatus } from '@/generated/prisma/enums'
import {
  canAddKYPDetails,
  canCompletePreAuth,
  canEditDischargeSheet,
  canEditIPDDetails,
  canFillCashDischarge,
  canFillInitiateForm,
  canFillIPDCashForm,
  canGeneratePDF,
  canInitiate,
  canMarkIPD,
  canMarkLost,
  canModifyHospitals,
  canRaisePreAuth,
  canResetStepper,
  canRevertCashMode,
  canStartCashMode,
  canSuggestHospitals,
  canViewInitiateForm,
  isDischargeBlockedByInitiateForm,
  isReadOnlyPatientRole
} from '@/lib/case-permissions'
import { getKYPStatusLabel } from '@/lib/kyp-status-labels'
import { resolveLeadHospitalDoctor } from '@/lib/lead-display'
import {
  getEffectiveOpdCounts,
  getNextAvailableOpdSlot,
  type EffectiveOpdEntry,
} from '@/lib/lead-opd-appointments'
import { hasLeadOpdDone, hasLeadOpdScheduled } from '@/lib/lead-opd-workflow'
import { normalizeLeadStatus } from '@/lib/pipeline-lead-buckets'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'
import { format, formatDistanceToNow } from 'date-fns'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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

function toDateTimeLocalInputValue(value: string | Date | null | undefined) {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return format(parsed, "yyyy-MM-dd'T'HH:mm")
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
  diseaseDetails?: string | null
  surgeonName?: string | null
  surgeonType?: string | null
  status: string
  pipelineStage: string
  caseStage: CaseStage
  isOldCrmLead?: boolean
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
  ipdPotentialDate?: string | null
  ipdPotentialMarkedAt?: string | null
  month?: string | null
  profession?: string | null
  teamLeadId?: number | null
  opdHospital?: string | null
  opdDrName?: string | null
  opdContactNo?: string | null
  opdCharges?: number | null
  opdScheduleDate?: string | null
  opdMeeting?: number | null
  opdSurgeryAdvised?: string | null
  opdImplantRequired?: boolean | null
  opdDiagnosis?: string | null
  opdSurgeryRemark?: {
    code?: string | null
    label?: string | null
  } | null
  opdReasonNoSurgery?: {
    code?: string | null
    label?: string | null
  } | null
  opdFollowUpReason?: {
    code?: string | null
    label?: string | null
  } | null
  opdPrescriptionImages?: Array<{
    id: string
    fileName: string
    fileUrl: string
    storageKey?: string | null
    sortOrder?: number | null
  }> | null
  effectiveOpdAppointments?: Array<{
    id: string
    leadId: string
    source: 'legacy' | 'record'
    phase: LeadOpdPhase
    slot: 1 | 2
    status: LeadOpdStatus
    hospitalName?: string | null
    doctorName?: string | null
    contactNumber?: string | null
    charges?: number | null
    scheduleDate?: string | null
    meetingType?: number | null
    surgeryAdvised?: string | null
    surgeryRemark?: { code?: string | null; label?: string | null } | null
    surgeryRemarkCode?: string | null
    reasonNoSurgery?: { code?: string | null; label?: string | null } | null
    reasonNoSurgeryCode?: string | null
    followUpReason?: { code?: string | null; label?: string | null } | null
    followUpReasonCode?: string | null
    implantRequired?: boolean | null
    diagnosis?: string | null
    remarks?: string | null
    prescriptionImages?: Array<{
      id: string
      fileName: string
      fileUrl: string
      storageKey?: string | null
      sortOrder?: number | null
    }> | null
    isFirstEffectivePreOpd?: boolean
    editableByBd?: boolean
  }> | null
  opdCounts?: {
    pre: number
    post: number
  } | null
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
    holdReason?: string | null
    heldAt?: string | null
    heldBy?: {
      id: string
      name: string
    } | null
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

function formatCaseStageLabel(stage: CaseStage | string | null | undefined) {
  if (!stage) return null
  return String(stage).replace(/_/g, ' ')
}

function getOpdModeLabel(opdMeeting: number | null | undefined) {
  if (opdMeeting === 2) return 'Online'
  if (opdMeeting === 1) return 'Offline'
  return null
}

function getOpdSurgeryAdvisedLabel(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'yes') return 'Yes'
  if (normalized === 'no') return 'No'
  if (normalized === 'follow_up' || normalized === 'follow-up' || normalized === 'follow up') {
    return 'Follow-up'
  }
  return value || null
}

function getVisibleOpdDoctorRemarks(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  if (
    /^opd marked done by\b/i.test(trimmed) ||
    /^opd cancelled by\b/i.test(trimmed) ||
    /^opd scheduled by\b/i.test(trimmed) ||
    /^doctor follow-up required marked by\b/i.test(trimmed)
  ) {
    return null
  }

  return trimmed
}

export default function PatientDetailsPage() {
  const { user } = useAuth()
  const { hasAccess, permissions } = usePermissions()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string
  const listReturnTo = resolveReturnTo(searchParams)
  const withReturnTo = useMemo(
    () => (href: string) => hrefWithReturnTo(href, listReturnTo),
    [listReturnTo],
  )
  const handleBack = () => {
    if (listReturnTo) router.push(listReturnTo)
    else router.back()
  }

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
  const [makeCallLoading, setMakeCallLoading] = useState(false)
  const [leadEditDrawerOpen, setLeadEditDrawerOpen] = useState(false)

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
  const [showIpdPotentialDialog, setShowIpdPotentialDialog] = useState(false)
  const [ipdPotentialDateInput, setIpdPotentialDateInput] = useState('')
  const [ipdPotentialSubmitting, setIpdPotentialSubmitting] = useState(false)
  const [markLostReason, setMarkLostReason] = useState<string>('')
  const [markLostDetail, setMarkLostDetail] = useState('')
  const [markLostSubmitting, setMarkLostSubmitting] = useState(false)
  const [switchingMode, setSwitchingMode] = useState(false)
  const [showConvertCashDialog, setShowConvertCashDialog] = useState(false)
  const [showRevertToInsuranceDialog, setShowRevertToInsuranceDialog] = useState(false)

  const handleRevertToInsurance = async () => {
    setSwitchingMode(true)
    setShowRevertToInsuranceDialog(false)
    try {
      const targetStage = lead?.kypSubmission
        ? CaseStage.KYP_BASIC_COMPLETE
        : hasLeadOpdDone(lead as any)
          ? CaseStage.OPD_DONE
          : hasLeadOpdScheduled(lead as any)
            ? CaseStage.OPD_SCHEDULED
            : CaseStage.NEW_LEAD
      await apiPatch(`/api/leads/${leadId}`, {
        flowType: FlowType.INSURANCE,
        caseStage: targetStage,
        stageChangeNote: 'Reverted to Insurance Flow'
      })
      toast.success('Reverted to Insurance Flow')
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
    } catch {
      toast.error('Failed to revert mode')
    } finally {
      setSwitchingMode(false)
    }
  }

  const handleConvertToCash = async () => {
    setSwitchingMode(true)
    setShowConvertCashDialog(false)
    try {
      await apiPatch(`/api/leads/${leadId}`, {
        flowType: FlowType.CASH,
        caseStage: hasLeadOpdDone(lead as any)
          ? CaseStage.CASH_OPD_DONE
          : hasLeadOpdScheduled(lead as any)
            ? CaseStage.CASH_OPD_SCHEDULED
            : CaseStage.CASH_IPD_PENDING,
        stageChangeNote: 'Converted from Insurance to Cash'
      })
      toast.success('Converted to Cash Mode')
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
    } catch {
      toast.error('Failed to convert mode')
    } finally {
      setSwitchingMode(false)
    }
  }
  const [markingOpdId, setMarkingOpdId] = useState<string | null>(null)
  const [postponeTargetOpd, setPostponeTargetOpd] = useState<EffectiveOpdEntry | null>(null)
  const [postponeDateInput, setPostponeDateInput] = useState('')
  const [postponeSubmitting, setPostponeSubmitting] = useState(false)
  const [cancelTargetOpd, setCancelTargetOpd] = useState<EffectiveOpdEntry | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [showResetStepperDialog, setShowResetStepperDialog] = useState(false)
  const [handledQuickAction, setHandledQuickAction] = useState<string | null>(null)
  const quickAction = searchParams.get('action')

  const handleBackendMakeCall = async () => {
    try {
      setMakeCallLoading(true)
      await apiPost(`/api/leads/${leadId}/make-call`, {})
      toast.success('Call initiated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initiate call')
    } finally {
      setMakeCallLoading(false)
    }
  }

  useEffect(() => {
    if (!leadId) return

    void apiPost(`/api/leads/${leadId}/opened`, {})
  }, [leadId])

  useEffect(() => {
    if (!lead || !quickAction || quickAction === handledQuickAction) return

    if (
      quickAction === 'ipd-schedule' &&
      lead.flowType !== FlowType.CASH &&
      ([CaseStage.PREAUTH_COMPLETE, CaseStage.INITIATED, CaseStage.ADMITTED] as CaseStage[]).includes(
        lead.caseStage as CaseStage
      )
    ) {
      const timer = window.setTimeout(() => {
        setAdmitEditMode(lead.caseStage !== CaseStage.PREAUTH_COMPLETE)
        setShowAdmitModal(true)
        setHandledQuickAction(quickAction)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (
      quickAction === 'ipd-cash' &&
      lead.flowType === FlowType.CASH &&
      ([
        CaseStage.CASH_IPD_PENDING,
        CaseStage.CASH_OPD_SCHEDULED,
        CaseStage.CASH_OPD_DONE,
        CaseStage.CASH_IPD_SUBMITTED,
        CaseStage.CASH_ON_HOLD,
        CaseStage.CASH_APPROVED,
      ] as CaseStage[]).includes(
        lead.caseStage as CaseStage
      )
    ) {
      const timer = window.setTimeout(() => {
        setShowIPDCashModal(true)
        setHandledQuickAction(quickAction)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (quickAction === 'edit-lead') {
      const timer = window.setTimeout(() => {
        setLeadEditDrawerOpen(true)
        setHandledQuickAction(quickAction)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [handledQuickAction, lead, quickAction])

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
          <Button variant="outline" onClick={handleBack}>
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
      [CaseStage.OPD_SCHEDULED]: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-300',
      [CaseStage.OPD_DONE]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 border-teal-300',
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
      [CaseStage.CASH_OPD_SCHEDULED]: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-300',
      [CaseStage.CASH_OPD_DONE]: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 border-teal-300',
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
    const emiItems = normalizeModeOfPaymentKey(lead.modeOfPayment) === 'emi' ? [
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
        `Mode: ${normalizeModeOfPaymentLabel(lead.modeOfPayment) ?? '—'}`,
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
  const hasScheduledOpd = hasLeadOpdScheduled(lead)
  const hasDoneOpd = hasLeadOpdDone(lead)
  const canMarkOpdAction =
    !readOnly &&
    !!user &&
    (isSalesLeadWorkerRole(user.role) || user.role === 'ADMIN')
  const canFillIPDCash = !readOnly && !!user && canFillIPDCashForm(user as any, lead)
  const canFillCashDischargeSheet = !readOnly && user && canFillCashDischarge(user as any, lead)
  const canMarkIpdPotential =
    !readOnly &&
    !!user &&
    (
      user.role === 'BD' ||
      user.role === 'TEAM_LEAD' ||
      user.role === 'CATEGORY_MANAGER' ||
      user.role === 'SALES_HEAD' ||
      user.role === 'EXECUTIVE_ASSISTANT'
    ) &&
    !lead.ipdPotentialDate
  const displayStatus = normalizeLeadStatus(lead.status)
  const effectiveOpdAppointments = (lead.effectiveOpdAppointments ?? []) as EffectiveOpdEntry[]
  const opdCounts = lead.opdCounts ?? getEffectiveOpdCounts(effectiveOpdAppointments)
  const preOpds = effectiveOpdAppointments.filter((entry) => entry.phase === LeadOpdPhase.PRE)
  const postOpds = effectiveOpdAppointments.filter((entry) => entry.phase === LeadOpdPhase.POST)
  const canManageOpd =
    !!user &&
    (user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ADMIN') &&
    (
      lead.flowType === FlowType.CASH
        ? ([
            CaseStage.CASH_IPD_PENDING,
            CaseStage.CASH_OPD_SCHEDULED,
            CaseStage.CASH_OPD_DONE,
            CaseStage.CASH_IPD_SUBMITTED,
            CaseStage.CASH_ON_HOLD,
            CaseStage.CASH_APPROVED,
          ] as CaseStage[]).includes(lead.caseStage as CaseStage)
        : ([
            CaseStage.NEW_LEAD,
            CaseStage.OPD_SCHEDULED,
            CaseStage.OPD_DONE,
            CaseStage.KYP_BASIC_PENDING,
            CaseStage.KYP_BASIC_COMPLETE,
            CaseStage.HOSPITALS_SUGGESTED,
            CaseStage.PREAUTH_RAISED,
            CaseStage.PREAUTH_COMPLETE,
            CaseStage.INITIATED,
            CaseStage.ADMITTED,
            CaseStage.IPD_DONE,
            CaseStage.DISCHARGED,
            CaseStage.PL_PENDING,
            CaseStage.OUTSTANDING,
          ] as CaseStage[]).includes(lead.caseStage as CaseStage)
    )
  const canAddPreOpd = canManageOpd && getNextAvailableOpdSlot(effectiveOpdAppointments, LeadOpdPhase.PRE) !== null
  const canAddPostOpd =
    canManageOpd &&
    getNextAvailableOpdSlot(effectiveOpdAppointments, LeadOpdPhase.POST) !== null &&
    ([CaseStage.IPD_DONE, CaseStage.CASH_IPD_DONE, CaseStage.DISCHARGED, CaseStage.CASH_DISCHARGED, CaseStage.PL_PENDING, CaseStage.OUTSTANDING] as CaseStage[]).includes(lead.caseStage)
  const showOpdDetails = effectiveOpdAppointments.length > 0
  const canEditOpdEntry = (entry: EffectiveOpdEntry) =>
    canManageOpd && !(user?.role === 'BD' && entry.status === LeadOpdStatus.DONE)
  const canMarkOpdEntry = (entry: EffectiveOpdEntry) =>
    canMarkOpdAction &&
    entry.status !== LeadOpdStatus.DONE &&
    entry.status !== LeadOpdStatus.CANCELLED
  const canPostponeOpdEntry = (entry: EffectiveOpdEntry) =>
    user?.role === 'BD' &&
    canManageOpd &&
    Boolean(entry.scheduleDate) &&
    entry.status !== LeadOpdStatus.DONE &&
    entry.status !== LeadOpdStatus.CANCELLED
  const canCancelOpdEntry = (entry: EffectiveOpdEntry) =>
    user?.role === 'BD' &&
    canManageOpd &&
    entry.status !== LeadOpdStatus.DONE &&
    entry.status !== LeadOpdStatus.CANCELLED

  function getOpdTargetId(entry: EffectiveOpdEntry) {
    return entry.source === 'legacy' ? 'legacy' : entry.id
  }

  async function handleMarkOpdDone(entry: EffectiveOpdEntry) {
    try {
      setMarkingOpdId(entry.id)
      await apiPatch(`/api/leads/${leadId}/opds/${getOpdTargetId(entry)}`, {
        markDone: true,
      })
      toast.success('OPD marked done')
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
    } catch {
      toast.error('Failed to mark OPD done')
    } finally {
      setMarkingOpdId(null)
    }
  }

  function openPostponeDialog(entry: EffectiveOpdEntry) {
    setPostponeTargetOpd(entry)
    setPostponeDateInput(toDateTimeLocalInputValue(entry.scheduleDate))
  }

  async function handlePostponeOpd() {
    if (!postponeTargetOpd) return
    if (!postponeDateInput) {
      toast.error('Please select a new OPD date and time')
      return
    }

    const currentDateInput = toDateTimeLocalInputValue(postponeTargetOpd.scheduleDate)
    if (currentDateInput === postponeDateInput) {
      toast.error('Please choose a different date or time to postpone this OPD')
      return
    }

    try {
      setPostponeSubmitting(true)
      await apiPatch(`/api/leads/${leadId}/opds/${getOpdTargetId(postponeTargetOpd)}`, {
        scheduleDate: postponeDateInput,
      })
      toast.success('OPD postponed')
      setPostponeTargetOpd(null)
      setPostponeDateInput('')
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to postpone OPD')
    } finally {
      setPostponeSubmitting(false)
    }
  }

  async function handleCancelOpd() {
    if (!cancelTargetOpd) return

    try {
      setCancelSubmitting(true)
      await apiPatch(`/api/leads/${leadId}/opds/${getOpdTargetId(cancelTargetOpd)}`, {
        cancel: true,
      })
      toast.success('OPD cancelled')
      setCancelTargetOpd(null)
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel OPD')
    } finally {
      setCancelSubmitting(false)
    }
  }

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
                  onClick={handleBack}
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
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl">
                      {lead.patientName}
                    </h1>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setLeadEditDrawerOpen(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
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
                    {(lead.status || hasScheduledOpd) && (
                      <>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span className="text-gray-500 dark:text-gray-400">{displayStatus}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleBackendMakeCall}
                  disabled={makeCallLoading}
                >
                  {makeCallLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneCall className="h-4 w-4" />
                  )}
                  Make Call
                </Button>
                <LeadQrPopover
                  leadId={leadId}
                  phoneNumber={lead.phoneNumber ?? ''}
                  patientName={lead.patientName}
                  triggerVariant="button"
                  buttonLabel="Lead QR"
                  allowServerSidePhoneLookup
                />
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
                {lead.isOldCrmLead ? (
                  <Badge className="border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    Old CRM Lead
                  </Badge>
                ) : null}
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
                  : rec?.surgeryDate || lead.surgeryDate
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
                    {(lead.treatment?.toLowerCase().includes('lipoma') || lead.category?.toLowerCase() === 'lipoma') && (
                      <DossierField icon={Tag} label="Count" value={lead.quantityGrade} />
                    )}
                    {(lead.treatment?.toLowerCase().includes('gynecomastia') || lead.category?.toLowerCase() === 'gynecomastia') && (
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                {lead.flowType === FlowType.CASH ? 'Cash Flow Progress' : 'Case Progress'}
              </p>
              <div className="flex items-center gap-2">
                {lead.flowType === FlowType.CASH && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Cash Mode
                  </Badge>
                )}
                {user &&
                  canResetStepper(user as any, hasAccess, permissions) &&
                  lead.caseStage !== CaseStage.NEW_LEAD &&
                  !(
                    lead.flowType === FlowType.CASH &&
                    lead.caseStage === CaseStage.CASH_IPD_PENDING &&
                    !hasScheduledOpd
                  ) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                    onClick={() => setShowResetStepperDialog(true)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset Step
                  </Button>
                )}
              </div>
            </div>
            {lead.flowType === FlowType.CASH ? (
              <CashStageProgress
                currentStage={lead.caseStage}
                hasOpdScheduled={hasScheduledOpd}
                hasOpdDone={hasDoneOpd}
              />
            ) : (
              <StageProgress
                currentStage={lead.caseStage}
                hasOpdScheduled={hasScheduledOpd}
                hasOpdDone={hasDoneOpd}
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
                          caseStage: hasDoneOpd
                            ? CaseStage.CASH_OPD_DONE
                            : hasScheduledOpd
                              ? CaseStage.CASH_OPD_SCHEDULED
                              : CaseStage.CASH_IPD_PENDING,
                          stageChangeNote: 'Switched to Cash Mode'
                        })
                        toast.success('Switched to Cash Mode')
                        queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                      } catch {
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

                {/* Convert Cashless (Insurance) Case to Cash Case */}
                {canStartCash && lead.flowType !== FlowType.CASH && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20 dark:border-green-200 text-green-400 dark:text-green-300"
                    disabled={switchingMode}
                    onClick={() => setShowConvertCashDialog(true)}
                  >
                    <ArrowRight className="h-4 w-4" /> Convert to Cash
                  </Button>
                )}

                {canRevertCash && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={switchingMode}
                    onClick={() => setShowRevertToInsuranceDialog(true)}
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
                    <Link href={withReturnTo(`/patient/${leadId}/discharge-cash`)}>
                      <Receipt className="h-4 w-4" />
                      Fill Discharge Form
                    </Link>
                  </Button>
                )}

                {canAddPreOpd && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/opd-schedule?phase=PRE`}>
                      <Plus className="h-4 w-4" />
                      Add Pre OPD
                    </Link>
                  </Button>
                )}

                {canAddPostOpd && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                  >
                    <Link href={`/patient/${leadId}/opd-schedule?phase=POST`}>
                      <Plus className="h-4 w-4" />
                      Add Post OPD
                    </Link>
                  </Button>
                )}

                {canMarkIpdPotential && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex items-center gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/30"
                    onClick={() => {
                      setIpdPotentialDateInput('')
                      setShowIpdPotentialDialog(true)
                    }}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Mark IPD Possibility
                  </Button>
                )}

                {/* BD / TL Actions (Insurance Flow) — OPD is optional, so card details can start directly from early stages */}
                {lead.flowType !== FlowType.CASH && (user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ASSISTANT_CATEGORY_MANAGER' || user.role === 'CATEGORY_MANAGER' || user.role === 'ADMIN') && ([CaseStage.NEW_LEAD, CaseStage.OPD_SCHEDULED, CaseStage.OPD_DONE, CaseStage.KYP_BASIC_PENDING] as CaseStage[]).includes(lead.caseStage as CaseStage) && (
                  <Button
                    asChild
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  >
                    <Link href={withReturnTo(`/patient/${leadId}/kyp/basic`)}>
                      <Plus className="h-4 w-4" />
                      Fill Card Details
                    </Link>
                  </Button>
                )}
                {lead.flowType !== FlowType.CASH && (user.role === 'BD' || user.role === 'TEAM_LEAD' || user.role === 'ASSISTANT_CATEGORY_MANAGER' || user.role === 'CATEGORY_MANAGER' || user.role === 'ADMIN') && lead.caseStage === CaseStage.KYP_BASIC_COMPLETE && (
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
                    <Link href={withReturnTo(`/patient/${leadId}/pre-auth`)}>
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
                    <Link href={withReturnTo(`/patient/${leadId}/pre-auth`)}>
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
                    <Link href={withReturnTo(`/patient/${leadId}/pre-auth`)}>
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
                    <Link href={withReturnTo(`/patient/${leadId}/pre-auth`)}>
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
                    <Link href={withReturnTo(`/patient/${leadId}/pre-auth?initiate=true`)}>
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
                {lead.admissionRecord && ['BD', 'TEAM_LEAD', 'ASSISTANT_CATEGORY_MANAGER', 'CATEGORY_MANAGER', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role) && (
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
                    <Link href={withReturnTo(`/patient/${leadId}/discharge`)}>
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

              {lead.ipdPotentialDate ? (
                <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
                  <div className="font-medium">Potential IPD marked</div>
                  <div className="mt-1">
                    Expected IPD by {format(new Date(lead.ipdPotentialDate), 'dd MMM yyyy')}
                  </div>
                  {lead.ipdPotentialMarkedAt ? (
                    <div className="mt-1 text-xs text-violet-700 dark:text-violet-300">
                      Locked on {format(new Date(lead.ipdPotentialMarkedAt), 'dd MMM yyyy, h:mm a')}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {showOpdDetails && (
          <Card className="border-2 shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <CalendarIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <CardTitle>OPD Details</CardTitle>
                  <Badge className="border-0 bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                    {opdCounts.pre} Pre OPD{opdCounts.pre === 1 ? '' : 's'}
                  </Badge>
                  <Badge className="border-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                    {opdCounts.post} Post OPD{opdCounts.post === 1 ? '' : 's'}
                  </Badge>
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white/70 px-2 py-0.5 text-[11px] text-gray-600 dark:border-gray-700 dark:bg-black/30 dark:text-gray-400">
                    <Activity className="w-3 h-3" />
                    {formatCaseStageLabel(lead.caseStage)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Grouped OPD history</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {[
                { title: 'Pre OPDs', items: preOpds },
                { title: 'Post OPDs', items: postOpds },
              ].map((group) => (
                <div key={group.title} className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} item{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {group.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No {group.title.toLowerCase()} yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {group.items.map((entry) => {
                        const scheduleLabel = entry.scheduleDate
                          ? format(new Date(entry.scheduleDate), 'dd MMM yyyy · hh:mm a')
                          : null
                        const entryChargeValue =
                          entry.charges != null
                            ? `₹${Number(entry.charges).toLocaleString('en-IN')}`
                            : null
                        const entryImages = entry.prescriptionImages ?? []
                        const visibleDoctorRemarks = getVisibleOpdDoctorRemarks(entry.remarks)

                        return (
                            <div key={entry.id} className="rounded-xl border bg-card p-4">
                            <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  className={cn(
                                    'border-0',
                                    entry.status === LeadOpdStatus.DONE
                                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                                      : entry.status === LeadOpdStatus.CANCELLED
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                                        : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'
                                  )}
                                >
                                  {String(entry.status).replace(/_/g, ' ')}
                                </Badge>
                                {entry.source === 'legacy' ? (
                                  <Badge variant="secondary">Legacy</Badge>
                                ) : null}
                                {entry.isFirstEffectivePreOpd ? (
                                  <Badge variant="secondary">Primary OPD</Badge>
                                ) : null}
                                {entry.surgeryAdvised === 'follow_up' ? (
                                  <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                    Doctor Follow-up Required
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                {canMarkOpdEntry(entry) ? (
                                  <Button
                                    size="sm"
                                    className="bg-teal-600 hover:bg-teal-700 text-white border-0"
                                    disabled={markingOpdId === entry.id}
                                    onClick={() => handleMarkOpdDone(entry)}
                                  >
                                    {markingOpdId === entry.id ? (
                                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                                    )}
                                    Mark OPD Done
                                  </Button>
                                ) : null}
                                {canPostponeOpdEntry(entry) ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={postponeSubmitting || cancelSubmitting}
                                    onClick={() => openPostponeDialog(entry)}
                                  >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    Postpone
                                  </Button>
                                ) : null}
                                {canCancelOpdEntry(entry) ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                                    disabled={postponeSubmitting || cancelSubmitting}
                                    onClick={() => setCancelTargetOpd(entry)}
                                  >
                                    <XCircle className="mr-2 h-3.5 w-3.5" />
                                    Cancel
                                  </Button>
                                ) : null}
                                {canEditOpdEntry(entry) ? (
                                  <Button asChild size="sm" variant="outline">
                                    <Link
                                      href={
                                        entry.source === 'legacy'
                                          ? `/patient/${leadId}/opd-schedule?opdId=legacy`
                                          : `/patient/${leadId}/opd-schedule?opdId=${entry.id}`
                                      }
                                    >
                                      <Pencil className="mr-2 h-3.5 w-3.5" />
                                      Edit
                                    </Link>
                                  </Button>
                                ) : null}
                              </div>
                            </div>

                            <Section
                              icon={Stethoscope}
                              iconClassName="text-cyan-600"
                              title="Appointment Snapshot"
                              hasContent
                            >
                              <Field label="OPD ID" value={`OPD-${lead.leadRef}`} />
                              <Field label="Patient Name" value={lead.patientName} />
                              <Field
                                label="Age / Sex"
                                value={
                                  lead.age != null || lead.sex
                                    ? `${lead.age ?? '—'} / ${lead.sex ?? '—'}`
                                    : null
                                }
                              />
                              <Field label="Patient Number" value={lead.phoneNumber} />
                              <Field label="Alternative Number" value={lead.alternateNumber} />
                              <Field label="Circle" value={lead.circle} />
                              <Field label="Category" value={lead.category} />
                              <Field label="Treatment" value={lead.treatment} />
                              <Field label="Quantity / Grade" value={lead.quantityGrade} />
                              <Field label="Hospital / Clinic" value={entry.hospitalName || lead.hospitalName} />
                              <Field label="Doctor" value={entry.doctorName || lead.surgeonName} />
                              <Field label="Doctor Type" value={lead.surgeonType} />
                              <Field label="Scheduled At" value={scheduleLabel} />
                              <Field label="OPD Mode" value={getOpdModeLabel(entry.meetingType)} />
                              <Field label="Charges" value={entryChargeValue} />
                            </Section>

                            <div className="mt-4 grid gap-4">
                              <Section
                                icon={FileText}
                                iconClassName="text-emerald-600"
                                title="Doctor Notes"
                                hasContent={
                                  Boolean(
                                    visibleDoctorRemarks ||
                                      entry.surgeryAdvised ||
                                      entry.diagnosis ||
                                      entry.surgeryRemark?.label ||
                                      entry.reasonNoSurgery?.label ||
                                      entry.followUpReason?.label ||
                                      typeof entry.implantRequired === 'boolean'
                                  )
                                }
                              >
                                <Field
                                  label="Surgery Advised"
                                  value={getOpdSurgeryAdvisedLabel(entry.surgeryAdvised)}
                                />
                                <Field label="Surgery Remark" value={entry.surgeryRemark?.label} />
                                <Field
                                  label="Reason for No Surgery"
                                  value={entry.reasonNoSurgery?.label}
                                />
                                <Field label="Follow-up Reason" value={entry.followUpReason?.label} />
                                <Field
                                  label="Implant Required"
                                  value={
                                    typeof entry.implantRequired === 'boolean'
                                      ? entry.implantRequired
                                        ? 'Yes'
                                        : 'No'
                                      : null
                                  }
                                />
                                <Field label="Diagnosis" value={entry.diagnosis} />
                                {visibleDoctorRemarks ? (
                                  <div className="col-span-2 sm:col-span-3 md:col-span-4">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Doctor Remarks
                                    </p>
                                    <p className="whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm">
                                      {visibleDoctorRemarks}
                                    </p>
                                  </div>
                                ) : null}
                              </Section>
                              <Section
                                icon={File}
                                iconClassName="text-blue-600"
                                title="Prescription Images"
                                hasContent={entryImages.length > 0}
                              >
                                <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-3 md:col-span-4">
                                  {entryImages.map((image, imageIndex) => (
                                    <Button
                                      key={image.id}
                                      asChild
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 text-[11px]"
                                    >
                                      <a href={image.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3" />
                                        {image.fileName?.trim() || `Prescription ${imageIndex + 1}`}
                                      </a>
                                    </Button>
                                  ))}
                                </div>
                              </Section>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
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
        {kypSubmission?.preAuthData && (() => {
          const pre = kypSubmission.preAuthData
          const requestedName = pre.requestedHospitalName?.trim()
          const requestedRoom = (pre.requestedRoomType || '').toLowerCase().replace(/\s+/g, ' ')
          const selectedHosp = requestedName && pre.suggestedHospitals?.length
            ? pre.suggestedHospitals.find((h) => h.hospitalName?.trim() === requestedName)
            : null
          const selectedRoomRent = selectedHosp
            ? (requestedRoom.includes('single') && selectedHosp.roomRentSingle != null ? selectedHosp.roomRentSingle
              : (requestedRoom.includes('semi') || requestedRoom.includes('private')) && selectedHosp.roomRentSemiPrivate != null ? selectedHosp.roomRentSemiPrivate
                : requestedRoom.includes('deluxe') && selectedHosp.roomRentDeluxe != null ? selectedHosp.roomRentDeluxe
                  : requestedRoom.includes('general') && selectedHosp.roomRentGeneral != null ? selectedHosp.roomRentGeneral
                    : selectedHosp.roomRentSingle ?? selectedHosp.roomRentSemiPrivate ?? selectedHosp.roomRentDeluxe ?? selectedHosp.roomRentGeneral ?? null)
            : null
          const disaseCapping =
            pre.capping != null && pre.capping !== ''
              ? typeof pre.capping === 'string' && !Number.isNaN(Number(pre.capping))
                ? `₹${Number(pre.capping).toLocaleString('en-IN')}`
                : String(pre.capping)
              : null

          const approvalBadge = pre.approvalStatus ? (
            <Badge className={cn(
              "border-0 ml-1",
              pre.approvalStatus === 'APPROVED' ? "bg-green-100 text-green-700" :
                pre.approvalStatus === 'REJECTED' ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
            )}>
              {pre.approvalStatus}
            </Badge>
          ) : null

          const processedMeta = pre.handledAt ? (
            <>Processed by <span className="font-semibold text-foreground">{pre.handledBy?.name || 'Insurance Team'}</span> on {format(new Date(pre.handledAt), 'PPp')}</>
          ) : null

          return (
            <Card className="border-2 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Insurance & Pre-Auth Details</CardTitle>
                  {approvalBadge}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Section
                  icon={FileText}
                  iconClassName="text-blue-600"
                  title="Policy Information"
                  meta={processedMeta}
                  hasContent
                >
                  <Field label="Insurance Co." value={pre.insurance || lead.insuranceName || kypSubmission.insuranceCard} />
                  <Field label="TPA" value={pre.tpa} />
                  <Field label="Sum Insured" value={pre.sumInsured != null ? `₹${Number(pre.sumInsured || 0).toLocaleString('en-IN')}` : null} truncate />
                  <Field label="Balance Insured" value={pre.balanceInsured != null ? `₹${Number(pre.balanceInsured || 0).toLocaleString('en-IN')}` : null} truncate />
                  <Field label="Co-pay %" value={pre.copay ? `${pre.copay}%` : null} />
                  <Field label="Disease Capping" value={disaseCapping} truncate />
                  {kypSubmission.insuranceCardFileUrl && (
                    <div className="col-span-2 sm:col-span-3 md:col-span-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Insurance Card (file)</p>
                      <a href={kypSubmission.insuranceCardFileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5">
                        {kypSubmission.insuranceCardFileUrl}
                      </a>
                    </div>
                  )}
                </Section>

                <Section icon={CheckCircle2} iconClassName="text-green-600" title="Selected Request" hasContent>
                  <Field label="Selected Hospital" value={pre.requestedHospitalName && <span className="text-blue-700 dark:text-blue-400">{pre.requestedHospitalName}</span>} />
                  <Field label="Room Category" value={pre.requestedRoomType} />
                  <Field label="Room Rent (selected)" value={selectedRoomRent != null ? `₹${Number(selectedRoomRent).toLocaleString('en-IN')}` : null} truncate />
                  {pre.preAuthRaisedAt && (
                    <div className="col-span-2 sm:col-span-3 md:col-span-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Raised On</p>
                      <p className="text-sm font-semibold mt-0.5">{format(new Date(pre.preAuthRaisedAt), 'PPp')}</p>
                      <p className="text-xs text-muted-foreground">By {pre.preAuthRaisedBy?.name}</p>
                    </div>
                  )}
                </Section>

                <Section
                  icon={Building2}
                  iconClassName="text-amber-600"
                  title="All Suggestions"
                  hasContent={!!(pre.suggestedHospitals && pre.suggestedHospitals.length > 0)}
                >
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {(pre.suggestedHospitals ?? []).map((hosp) => (
                      <div key={hosp.id} className={cn(
                        "p-2.5 rounded-lg border text-xs space-y-1 bg-card",
                        hosp.hospitalName === pre.requestedHospitalName
                          ? "border-blue-300 ring-1 ring-blue-400 dark:border-blue-700"
                          : "border-border"
                      )}>
                        <div className="flex justify-between font-bold">
                          <span className="truncate pr-2">{hosp.hospitalName}</span>
                          <span className="text-blue-600 dark:text-blue-400 shrink-0">₹{Number(hosp.tentativeBill || 0).toLocaleString('en-IN')}</span>
                        </div>
                        {hosp.suggestedDoctor && <div className="text-muted-foreground">{hosp.suggestedDoctor}</div>}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1 border-t border-border mt-1">
                          {hosp.roomRentSingle != null && <span>Sgl: ₹{hosp.roomRentSingle}</span>}
                          {hosp.roomRentSemiPrivate != null && <span>Semi: ₹{hosp.roomRentSemiPrivate}</span>}
                          {hosp.roomRentDeluxe != null && <span>Dlx: ₹{hosp.roomRentDeluxe}</span>}
                          {hosp.roomRentGeneral != null && <span>Gen: ₹{hosp.roomRentGeneral}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section
                  icon={FileText}
                  iconClassName="text-gray-600"
                  title="Remarks & Notes"
                  hasContent={!!(pre.diseaseDescription || pre.approvalNotes || pre.rejectionReason || pre.holdReason)}
                >
                  {pre.diseaseDescription && (
                    <div className="col-span-2 sm:col-span-3 md:col-span-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Disease Description (from BD)</p>
                      <p className="text-sm bg-card p-3 rounded-lg border">{pre.diseaseDescription}</p>
                    </div>
                  )}
                  {pre.holdReason && (
                    <div className="col-span-2 sm:col-span-3 md:col-span-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Hold Remark</p>
                      <p className="text-sm p-3 rounded-lg border italic bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/10 dark:border-orange-900/20 dark:text-orange-300">
                        &quot;{pre.holdReason}&quot;
                        {pre.heldBy?.name && (
                          <span className="block mt-1 text-xs not-italic text-muted-foreground">
                            Held by {pre.heldBy.name}{pre.heldAt ? ` on ${format(new Date(pre.heldAt), 'dd MMM yyyy, h:mm a')}` : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {(pre.approvalNotes || pre.rejectionReason) && (
                    <div className="col-span-2 sm:col-span-3 md:col-span-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                        {pre.approvalStatus === 'REJECTED' ? 'Rejection Reason' : 'Insurance Remarks'}
                      </p>
                      <p className={cn(
                        "text-sm p-3 rounded-lg border italic",
                        pre.approvalStatus === 'REJECTED'
                          ? "bg-red-50 border-red-100 text-red-700 dark:bg-red-950/10 dark:border-red-900/20"
                          : "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/10 dark:border-amber-900/20"
                      )}>
                        &quot;{pre.rejectionReason || pre.approvalNotes}&quot;
                      </p>
                    </div>
                  )}
                </Section>
              </CardContent>
            </Card>
          )
        })()}

        {/* Initiate Form Details */}
        {initiateFormData?.initiateForm && canViewInitiateForm(user as any, lead) && (
          <InitiateFormCard initiateForm={initiateFormData.initiateForm} />
        )}

        {/* IPD Details Section */}
        {lead.admissionRecord && (
          <IPDDetailsCard admissionRecord={lead.admissionRecord} lead={lead} />
        )}

        {/* Discharge & patient info — inline read-only panel, hidden from BD and TL */}
        {lead.dischargeSheet && user?.role !== 'BD' && user?.role !== 'TEAM_LEAD' && user?.role !== 'ASSISTANT_CATEGORY_MANAGER' && user?.role !== 'CATEGORY_MANAGER' && (
          <Card>
            <CardHeader>
              <CardTitle>Discharge</CardTitle>
              <CardDescription>Patient discharge information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PatientDischargeInfo leadId={leadId} lead={lead} />
              <Button asChild variant="outline">
                <Link href={withReturnTo(lead.flowType === FlowType.CASH ? `/patient/${leadId}/discharge-cash` : `/patient/${leadId}/discharge`)}>
                  <Receipt className="h-4 w-4 mr-2" />
                  {canFillDischargeForm ? 'Open Discharge Form' : 'View Discharge Sheet'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Activity Timeline */}
        {stageHistory && <ActivityTimeline history={stageHistory} />}

        {/* Knowlarity Call Recordings */}
        <KnowlarityCallRecordingsCard leadId={leadId} />

        {user && canResetStepper(user as any) && (
          <ResetStepperDialog
            leadId={leadId}
            open={showResetStepperDialog}
            onOpenChange={setShowResetStepperDialog}
          />
        )}

        <Dialog
          open={Boolean(postponeTargetOpd)}
          onOpenChange={(open) => {
            if (!open && !postponeSubmitting) {
              setPostponeTargetOpd(null)
              setPostponeDateInput('')
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Postpone OPD</DialogTitle>
              <DialogDescription>
                Update the OPD schedule date. This will keep the case stage unchanged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {postponeTargetOpd?.scheduleDate ? (
                  <>Current schedule: {format(new Date(postponeTargetOpd.scheduleDate), 'dd MMM yyyy')}</>
                ) : (
                  'No current schedule date available.'
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postpone-opd-date">New OPD date and time</Label>
                <Input
                  id="postpone-opd-date"
                  type="datetime-local"
                  value={postponeDateInput}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setPostponeDateInput(e.target.value)}
                  disabled={postponeSubmitting}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPostponeTargetOpd(null)
                    setPostponeDateInput('')
                  }}
                  disabled={postponeSubmitting}
                >
                  Close
                </Button>
                <Button onClick={handlePostponeOpd} disabled={postponeSubmitting}>
                  {postponeSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Postpone OPD'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(cancelTargetOpd)}
          onOpenChange={(open) => {
            if (!open && !cancelSubmitting) {
              setCancelTargetOpd(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel OPD</DialogTitle>
              <DialogDescription>
                Cancel this OPD appointment. This updates only the OPD status and keeps the case stage unchanged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {cancelTargetOpd?.scheduleDate ? (
                  <>Scheduled for {format(new Date(cancelTargetOpd.scheduleDate), 'dd MMM yyyy · hh:mm a')}</>
                ) : (
                  'This OPD does not have a scheduled date saved.'
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCancelTargetOpd(null)}
                  disabled={cancelSubmitting}
                >
                  Keep OPD
                </Button>
                <Button
                  onClick={handleCancelOpd}
                  disabled={cancelSubmitting}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {cancelSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Cancel OPD'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                key={`ipd-details-${leadId}-${admitEditMode ? 'edit' : 'create'}-${showAdmitModal ? 'open' : 'closed'}-${lead.admissionRecord?.id ?? 'none'}-${lead.updatedDate ?? 'na'}`}
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
                key={`ipd-cash-${leadId}-${showIPDCashModal ? 'open' : 'closed'}-${lead.admissionRecord?.id ?? 'none'}-${lead.updatedDate ?? 'na'}`}
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
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update IPD Status</DialogTitle>
              <DialogDescription>
                Update the current status of the patient in IPD.
              </DialogDescription>
            </DialogHeader>
            <IPDMarkComponent
              leadId={leadId}
              isCashFlow={lead.flowType === FlowType.CASH}
              defaultPatientName={lead.patientName ?? ''}
              existingAadharFiles={
                lead.kypSubmission?.aadharFiles && lead.kypSubmission.aadharFiles.length > 0
                  ? lead.kypSubmission.aadharFiles
                  : lead.kypSubmission?.aadharFileUrl
                    ? [{ name: 'Aadhaar', url: lead.kypSubmission.aadharFileUrl }]
                    : []
              }
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

        <Dialog open={showIpdPotentialDialog} onOpenChange={setShowIpdPotentialDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark IPD Possibility</DialogTitle>
              <DialogDescription>
                Set the date by which this patient is likely to convert to IPD. Once saved, it cannot be edited or deleted.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipdPotentialDate">Expected IPD date</Label>
                <Input
                  id="ipdPotentialDate"
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={ipdPotentialDateInput}
                  onChange={(event) => setIpdPotentialDateInput(event.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={ipdPotentialSubmitting}
                  onClick={() => {
                    setShowIpdPotentialDialog(false)
                    setIpdPotentialDateInput('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!ipdPotentialDateInput || ipdPotentialSubmitting}
                  onClick={async () => {
                    try {
                      setIpdPotentialSubmitting(true)
                      await apiPost(`/api/leads/${leadId}/ipd-potential`, {
                        potentialDate: ipdPotentialDateInput,
                      })
                      toast.success('IPD possibility marked')
                      setShowIpdPotentialDialog(false)
                      setIpdPotentialDateInput('')
                      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
                      queryClient.invalidateQueries({ queryKey: ['leads'] })
                      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to mark IPD possibility')
                    } finally {
                      setIpdPotentialSubmitting(false)
                    }
                  }}
                >
                  {ipdPotentialSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <ConfirmActionDialog
          open={showConvertCashDialog}
          onOpenChange={setShowConvertCashDialog}
          title="Convert to Cash Mode?"
          description="This will change the workflow of this lead from Insurance to Cash. This action will update the case stage accordingly. Do you want to proceed?"
          onConfirm={handleConvertToCash}
          confirmClassName="bg-green-600 hover:bg-green-700 text-white"
        />

        <ConfirmActionDialog
          open={showRevertToInsuranceDialog}
          onOpenChange={setShowRevertToInsuranceDialog}
          title="Switch to Insurance Flow?"
          description="This will revert the lead back to the Insurance flow and update the case stage accordingly. Do you want to proceed?"
          onConfirm={handleRevertToInsurance}
          confirmClassName="bg-amber-600 hover:bg-amber-700 text-white"
        />

        <LeadEditDrawer
          key={leadId}
          leadId={leadId}
          open={leadEditDrawerOpen}
          onOpenChange={setLeadEditDrawerOpen}
        />
      </div>
    </AuthenticatedLayout>
  )
}
