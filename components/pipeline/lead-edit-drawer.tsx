'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { getAvatarColor } from '@/lib/avatar-colors'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Loader2,
  MessageSquareQuote,
  PhoneCall,
  UserRoundPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import {
  formatLeadAssigneeName,
  formatLeadAssigneeRoleLabel,
} from '@/lib/lead-assignee-display'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { LeadQrPopover } from '@/components/leads/lead-qr-popover'
import { KnowlarityCallRecordingsCard } from '@/components/telephony/knowlarity-call-recordings-card'
import { normalizeLeadSexValue } from '@/lib/lead-sex'
import {
  CRM_LEAD_STATUS_OPTIONS,
  CRM_MODE_OF_PAYMENT_OPTIONS,
  isWorkflowManagedLeadStatus,
} from '@/lib/lead-status-options'
import {
  isStatusRequiringAgeSex,
  isStatusRequiringCity,
  isStatusRequiringFollowUpDate,
  isStatusRequiringModeOfPayment,
} from '@/lib/lead-status-rules'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const CRM_LEAD_SEX_OPTIONS = ['Male', 'Female', 'Other'] as const
const LEGACY_CURRENT_TREATMENT_OPTION_ID = '__legacy_current_treatment__'

function formatDisplayValue(value: unknown, fallback = '—') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function formatMaskedPhone(value: unknown, fallback = '—') {
  if (typeof value !== 'string') return fallback
  return maskPhoneNumber(value)
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'yyyy-MM-dd')
}

function toTimeInputValue(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const hours = parsed.getHours()
  const minutes = parsed.getMinutes()
  if (hours === 0 && minutes === 0) return ''
  return format(parsed, 'HH:mm')
}

function toCombinedDateTime(dateStr: string | null | undefined, timeStr: string | null | undefined) {
  if (!dateStr) return null
  const dateTrimmed = dateStr.trim()
  if (!dateTrimmed) return null
  const timeTrimmed = timeStr?.trim() ?? ''
  if (!timeTrimmed) return dateTrimmed
  return `${dateTrimmed}T${timeTrimmed}:00`
}

function getTodayDateInputValue() {
  return format(new Date(), 'yyyy-MM-dd')
}

type LeadEditLead = {
  id: string
  leadRef: string
  patientName: string
  phoneNumber?: string | null
  alternateNumber?: string | null
  city?: string | null
  whatsapp?: string | null
  age?: number | null
  sex?: string | null
  profession?: string | null
  treatment?: string | null
  diseaseDetails?: string | null
  status?: string | null
  subStatus?: string | null
  followUpDate?: string | null
  modeOfPayment?: string | null
  circle?: string | null
  category?: string | null
  treatmentMasterId?: string | null
  hospitalName?: string | null
  source?: string | null
  campaignName?: string | null
  month?: string | null
  surgeryDate?: string | null
  admissionRecord?: {
    surgeryDate?: string | null
  } | null
  address?: string | null
  bd?: {
    id: string
    name: string
  } | null
}

type MasterListResponse<T> = {
  items: T[]
}

type TreatmentCategoryMasterItem = {
  id: string
  name: string
  isActive?: boolean
}

type TreatmentMasterItem = {
  id: string
  name: string
  category: string
  isActive?: boolean
}

type LeadOwnershipUser = {
  id: string
  name: string
  email: string
  role: string
}

type LeadOwnershipMeta = {
  canEditLeadProfile: boolean
  canEditRemarks: boolean
  canUpdateStatus: boolean
  canReassign: boolean
  currentAssigneeId: string
  assignableUsers: LeadOwnershipUser[]
}

type LeadRemarkHistoryItem = {
  id: string
  content: string
  createdAt: string
  source: 'workspace' | 'legacy' | 'lead'
  createdBy: {
    id: string
    name: string | null
  }
}

type LeadRemarksResponse = {
  canEditRemarks: boolean
  canAddRemarks: boolean
  latestRemark: LeadRemarkHistoryItem | null
  remarks: LeadRemarkHistoryItem[]
}

type LeadActivityItem = {
  id: string
  action: string
  summary: string
  actorRole: string | null
  createdAt: string
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: {
    deviceInfo?: {
      browser?: string | null
      operatingSystem?: string | null
      deviceType?: string | null
      label?: string | null
    } | null
  } | null
  actorUser: {
    id: string
    name: string | null
    email: string | null
  } | null
}

type LeadAssignmentHistoryItem = {
  id: string
  source: 'initial' | 'reassigned' | 'current'
  assignedAt: string
  changedAt: string
  assignedTo: {
    id: string | null
    name: string | null
  }
  changedBy: {
    id: string | null
    name: string | null
    role: string | null
  } | null
  previousAssignedTo: {
    id: string | null
    name: string | null
  } | null
  automatic: boolean
  summary: string
}

type LeadActivityResponse = {
  canViewAssignmentHistory?: boolean
  canViewActivityLogs?: boolean
  assignmentHistory?: LeadAssignmentHistoryItem[]
  logs: LeadActivityItem[]
}

function ReadonlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">{value}</div>
    </div>
  )
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return '?'
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
}

function ActivityIcon({ action }: { action: string }) {
  const normalizedAction = action.toUpperCase()

  if (normalizedAction.includes('CREATED')) {
    return <CircleDot className="h-4 w-4 text-cyan-400" />
  }
  if (normalizedAction.includes('STATUS_CHANGED')) {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  }
  if (normalizedAction.includes('CALL_NOTE') || normalizedAction.includes('CALL')) {
    return <PhoneCall className="h-4 w-4 text-amber-400" />
  }
  if (normalizedAction.includes('REMARK')) {
    return <MessageSquareQuote className="h-4 w-4 text-sky-400" />
  }
  if (normalizedAction.includes('QR')) {
    return <PhoneCall className="h-4 w-4 text-amber-400" />
  }
  if (normalizedAction.includes('REASSIGNED') || normalizedAction.includes('ASSIGNED')) {
    return <UserRoundPlus className="h-4 w-4 text-violet-400" />
  }

  return <CircleDot className="h-4 w-4 text-muted-foreground" />
}

export function LeadEditDrawer({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const queryClient = useQueryClient()
  const [patientNameDraft, setPatientNameDraft] = useState<string | null>(null)
  const [alternateNumberDraft, setAlternateNumberDraft] = useState<string | null>(null)
  const [subStatusDraft, setSubStatusDraft] = useState<string | null>(null)
  const [whatsappDraft, setWhatsappDraft] = useState<string | null>(null)
  const [surgeryDateDraft, setSurgeryDateDraft] = useState<string | null>(null)
  const [assigneeIdDraft, setAssigneeIdDraft] = useState<string | null>(null)
  const [ageDraft, setAgeDraft] = useState<string | null>(null)
  const [sexDraft, setSexDraft] = useState<string | null>(null)
  const [cityDraft, setCityDraft] = useState<string | null>(null)
  const [professionDraft, setProfessionDraft] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState<string | null>(null)
  const [treatmentMasterIdDraft, setTreatmentMasterIdDraft] = useState<string | null>(null)
  const [leadStatusDraft, setLeadStatusDraft] = useState<string | null>(null)
  const [leadStatusSearch, setLeadStatusSearch] = useState('')
  const [leadStatusOpen, setLeadStatusOpen] = useState(false)
  const [followUpDateDraft, setFollowUpDateDraft] = useState<string | null>(null)
  const [followUpTimeDraft, setFollowUpTimeDraft] = useState<string | null>(null)
  const [modeOfPaymentDraft, setModeOfPaymentDraft] = useState<string | null>(null)
  const [statusChangeRemarkDraftState, setStatusChangeRemarkDraftState] = useState<{
    leadId: string | null
    baseValue: string
    value: string | null
  }>({
    leadId: null,
    baseValue: '',
    value: null,
  })
  const [expandedRemarksLeadId, setExpandedRemarksLeadId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [makeCallLoading, setMakeCallLoading] = useState(false)
  const leadStatusSearchInputRef = useRef<HTMLInputElement | null>(null)

  const { data: lead, isLoading, error } = useQuery<LeadEditLead, Error>({
    queryKey: ['lead-edit-drawer', leadId],
    queryFn: () => apiGet<LeadEditLead>(`/api/leads/${leadId}`),
    enabled: open && !!leadId,
    retry: false,
  })

  const handleMakeCall = async () => {
    if (!lead?.id) return
    const patientName = lead.patientName || 'patient'
    try {
      setMakeCallLoading(true)
      toast.info(`Initiating Knowlarity call for ${patientName}...`)
      await apiPost(`/api/leads/${lead.id}/make-call`, {})
      toast.success(`Knowlarity call initiated for ${patientName}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to initiate call via Knowlarity')
    } finally {
      setMakeCallLoading(false)
    }
  }

  const { data: leadOwnershipMeta, isLoading: isLoadingMeta } = useQuery<LeadOwnershipMeta, Error>({
    queryKey: ['lead-ownership-meta', leadId],
    queryFn: () => apiGet<LeadOwnershipMeta>(`/api/leads/${leadId}/assignable-users`),
    enabled: open && !!leadId,
    retry: false,
  })

  const { data: remarksData, isLoading: isLoadingRemarks } = useQuery<LeadRemarksResponse, Error>({
    queryKey: ['lead-remarks', leadId],
    queryFn: () => apiGet<LeadRemarksResponse>(`/api/leads/${leadId}/remarks`),
    enabled: open && !!leadId,
    retry: false,
  })

  const { data: activityData, isLoading: isLoadingActivity } = useQuery<LeadActivityResponse, Error>({
    queryKey: ['lead-activity', leadId],
    queryFn: () => apiGet<LeadActivityResponse>(`/api/leads/${leadId}/activity`),
    enabled: open && !!leadId,
    retry: false,
  })

  const { data: treatmentMasterData } = useQuery<MasterListResponse<TreatmentMasterItem>, Error>({
    queryKey: ['lead-edit-treatment-masters'],
    queryFn: () => apiGet<MasterListResponse<TreatmentMasterItem>>('/api/masters/treatments'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const { data: treatmentCategoryMasterData } = useQuery<
    MasterListResponse<TreatmentCategoryMasterItem>,
    Error
  >({
    queryKey: ['lead-edit-treatment-category-masters'],
    queryFn: () =>
      apiGet<MasterListResponse<TreatmentCategoryMasterItem>>('/api/masters/treatment-categories'),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const effectivePatientName = patientNameDraft ?? lead?.patientName ?? ''
  const effectiveAlternateNumber = alternateNumberDraft ?? (lead?.alternateNumber ?? '')
  const effectiveWhatsapp = whatsappDraft ?? (lead?.whatsapp ?? '')
  // Once IPD exists, its admission record owns the surgery date.
  const currentSurgeryDate = lead?.admissionRecord?.surgeryDate ?? lead?.surgeryDate
  const effectiveSurgeryDate = surgeryDateDraft ?? toDateInputValue(currentSurgeryDate)
  const effectiveAssigneeId = assigneeIdDraft ?? leadOwnershipMeta?.currentAssigneeId ?? lead?.bd?.id ?? ''
  const effectiveAge = ageDraft ?? (lead?.age == null ? '' : String(lead.age))
  const currentNormalizedSex = normalizeLeadSexValue(lead?.sex)
  const effectiveSex = sexDraft ?? currentNormalizedSex
  const effectiveCity = cityDraft ?? (lead?.city ?? '')
  const effectiveProfession = professionDraft ?? (lead?.profession ?? '')
  const currentCategory = lead?.category ?? ''
  const currentTreatment = lead?.treatment ?? ''
  const currentTreatmentMasterId = lead?.treatmentMasterId ?? ''
  const effectiveCategory = categoryDraft ?? currentCategory
  const effectiveLeadStatus = leadStatusDraft ?? (lead?.status ?? 'New')
  const effectiveSubStatus = subStatusDraft ?? (lead?.subStatus ?? '')
  const effectiveFollowUpDate = followUpDateDraft ?? toDateInputValue(lead?.followUpDate)
  const effectiveFollowUpTime = followUpTimeDraft ?? toTimeInputValue(lead?.followUpDate)
  const effectiveModeOfPayment = modeOfPaymentDraft ?? (lead?.modeOfPayment ?? '')
  const todayDateInputValue = getTodayDateInputValue()

  const categoryOptions = useMemo(() => {
    const items = (treatmentCategoryMasterData?.items ?? []).filter((item) => item.isActive !== false)
    const names = new Set(items.map((item) => item.name))
    if (currentCategory.trim().length > 0 && !names.has(currentCategory)) {
      return [{ id: '__current__', name: currentCategory }, ...items]
    }
    return items
  }, [currentCategory, treatmentCategoryMasterData?.items])

  const allTreatmentOptions = useMemo(
    () => (treatmentMasterData?.items ?? []).filter((item) => item.isActive !== false),
    [treatmentMasterData?.items]
  )

  const inferredCurrentTreatmentMasterId = useMemo(() => {
    if (currentTreatmentMasterId) return currentTreatmentMasterId
    if (!currentTreatment.trim()) return ''
    const exactMatch = allTreatmentOptions.find(
      (item) =>
        item.name === currentTreatment &&
        (!currentCategory.trim() || item.category === currentCategory)
    )
    return exactMatch?.id ?? LEGACY_CURRENT_TREATMENT_OPTION_ID
  }, [allTreatmentOptions, currentCategory, currentTreatment, currentTreatmentMasterId])

  const treatmentOptions = useMemo(() => {
    const selectedCategory = effectiveCategory.trim()
    const filtered = selectedCategory
      ? allTreatmentOptions.filter((item) => item.category === selectedCategory)
      : allTreatmentOptions
    const hasLegacyCurrentTreatment =
      currentTreatment.trim().length > 0 &&
      !filtered.some((item) => item.name === currentTreatment) &&
      (!selectedCategory || selectedCategory === currentCategory)

    if (hasLegacyCurrentTreatment) {
      return [
        {
          id: inferredCurrentTreatmentMasterId || LEGACY_CURRENT_TREATMENT_OPTION_ID,
          name: currentTreatment,
          category: currentCategory,
        },
        ...filtered,
      ]
    }

    return filtered
  }, [
    allTreatmentOptions,
    currentCategory,
    currentTreatment,
    effectiveCategory,
    inferredCurrentTreatmentMasterId,
  ])

  const effectiveTreatmentMasterId = useMemo(() => {
    const draftValue = treatmentMasterIdDraft ?? inferredCurrentTreatmentMasterId
    if (!draftValue) return ''
    return treatmentOptions.some((item) => item.id === draftValue) ? draftValue : ''
  }, [inferredCurrentTreatmentMasterId, treatmentMasterIdDraft, treatmentOptions])

  const canEditLeadProfile = leadOwnershipMeta?.canEditLeadProfile ?? false
  const canEditRemarks = leadOwnershipMeta?.canEditRemarks ?? false
  const canUpdateLeadStatus = leadOwnershipMeta?.canUpdateStatus ?? false
  const canReassignLead = leadOwnershipMeta?.canReassign ?? false
  const currentAssigneeId = leadOwnershipMeta?.currentAssigneeId ?? lead?.bd?.id ?? ''
  const currentAssigneeRecord =
    lead?.bd
      ? { name: lead.bd.name, email: null }
      : (leadOwnershipMeta?.assignableUsers.find((assignableUser) => assignableUser.id === currentAssigneeId) ??
        null)
  const currentAssigneeName =
    formatLeadAssigneeName(currentAssigneeRecord?.name, currentAssigneeRecord?.email)

  const currentStatus = lead?.status ?? 'New'
  const currentFollowUpDate = toDateInputValue(lead?.followUpDate)
  const currentFollowUpTime = toTimeInputValue(lead?.followUpDate)
  const currentModeOfPayment = lead?.modeOfPayment ?? ''
  const remarkHistory = remarksData?.remarks ?? []
  const previousRemark = remarksData?.latestRemark ?? null
  const latestRemarkContent = previousRemark?.content.trim() ?? ''
  const olderRemarks = previousRemark
    ? remarkHistory.filter((remark) => remark.id !== previousRemark.id)
    : remarkHistory
  const activityLogs = activityData?.logs ?? []
  const canViewAssignmentHistory = activityData?.canViewAssignmentHistory === true
  const canViewActivityLogs = activityData?.canViewActivityLogs ?? true
  const assignmentHistory = activityData?.assignmentHistory ?? []
  const hasLiveRemarkDraft =
    statusChangeRemarkDraftState.leadId === leadId &&
    statusChangeRemarkDraftState.baseValue === latestRemarkContent
  const statusChangeRemarkDraft = hasLiveRemarkDraft
    ? statusChangeRemarkDraftState.value ?? latestRemarkContent
    : latestRemarkContent
  const trimmedStatusChangeRemark = statusChangeRemarkDraft.trim()
  const remarkDirty =
    hasLiveRemarkDraft &&
    statusChangeRemarkDraftState.value !== null &&
    statusChangeRemarkDraftState.value !== latestRemarkContent
  const showAllRemarks = Boolean(leadId) && expandedRemarksLeadId === leadId

  const statusChanged = effectiveLeadStatus !== currentStatus
  const followUpDateChanged =
    effectiveFollowUpDate !== currentFollowUpDate ||
    effectiveFollowUpTime !== currentFollowUpTime
  const modeOfPaymentChanged = effectiveModeOfPayment !== currentModeOfPayment
  const statusRequiresFollowUpDate = isStatusRequiringFollowUpDate(effectiveLeadStatus)
  const shouldValidatePastFollowUpDate =
    Boolean(effectiveFollowUpDate) &&
    (
      followUpDateChanged ||
      (statusChanged && statusRequiresFollowUpDate)
    )
  const statusRequiresAgeSex = isStatusRequiringAgeSex(effectiveLeadStatus)
  const statusRequiresCity = isStatusRequiringCity(effectiveLeadStatus)
  const statusRequiresModeOfPayment = isStatusRequiringModeOfPayment(effectiveLeadStatus)
  const ageChanged = effectiveAge !== (lead?.age == null ? '' : String(lead.age))
  const alternateNumberChanged = isSuperAdmin && (effectiveAlternateNumber !== (lead?.alternateNumber ?? ''))
  const subStatusChanged = isSuperAdmin && (effectiveSubStatus !== (lead?.subStatus ?? ''))
  const sexChanged = effectiveSex !== currentNormalizedSex
  const cityChanged = effectiveCity !== (lead?.city ?? '')
  const professionChanged = effectiveProfession !== (lead?.profession ?? '')
  const categoryChanged = effectiveCategory !== currentCategory
  const treatmentChanged =
    treatmentMasterIdDraft !== null &&
    effectiveTreatmentMasterId !== inferredCurrentTreatmentMasterId

  const profileDirty =
    effectivePatientName !== (lead?.patientName ?? '') ||
    alternateNumberChanged ||
    effectiveWhatsapp !== (lead?.whatsapp ?? '') ||
    effectiveSurgeryDate !== toDateInputValue(currentSurgeryDate) ||
    ageChanged ||
    sexChanged ||
    cityChanged ||
    professionChanged ||
    categoryChanged ||
    treatmentChanged
  const assigneeDirty = effectiveAssigneeId !== currentAssigneeId

  const statusDirty = statusChanged || followUpDateChanged || modeOfPaymentChanged || subStatusChanged
  const isDirty = profileDirty || assigneeDirty || statusDirty || remarkDirty
  const saveDisabled =
    saving ||
    isLoading ||
    isLoadingMeta ||
    !lead ||
    !isDirty ||
    (profileDirty && !canEditLeadProfile) ||
    (assigneeDirty && !canReassignLead) ||
    (statusDirty && !canUpdateLeadStatus) ||
    ((statusChanged || remarkDirty) && !canEditRemarks)

  const statusOptions = Array.from(
    new Set(
      effectiveLeadStatus && effectiveLeadStatus.trim().length > 0
        ? [effectiveLeadStatus, ...CRM_LEAD_STATUS_OPTIONS]
        : CRM_LEAD_STATUS_OPTIONS
    )
  )

  const modeOfPaymentOptions = Array.from(
    new Set(
      effectiveModeOfPayment && effectiveModeOfPayment.trim().length > 0
        ? [effectiveModeOfPayment, ...CRM_MODE_OF_PAYMENT_OPTIONS]
        : CRM_MODE_OF_PAYMENT_OPTIONS
    )
  )
  const filteredStatusOptions = statusOptions.filter((statusOption) =>
    statusOption.toLowerCase().includes(leadStatusSearch.trim().toLowerCase())
  )
  const assigneeOptions = Array.from(
    new Map(
      [
        ...(currentAssigneeId
          ? [
              {
                id: currentAssigneeId,
                name: currentAssigneeName,
                email: '',
                role: '',
              },
            ]
          : []),
        ...(leadOwnershipMeta?.assignableUsers ?? []),
      ].map((assignableUser) => [assignableUser.id, assignableUser])
    ).values()
  )

  useEffect(() => {
    if (!leadStatusOpen) return

    const timer = window.requestAnimationFrame(() => {
      leadStatusSearchInputRef.current?.focus()
      leadStatusSearchInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(timer)
  }, [leadStatusOpen])

  async function handleSave() {
    if (!leadId || !lead) return

    if (profileDirty && !canEditLeadProfile) {
      toast.error('You do not have permission to edit patient profile fields for this lead')
      return
    }

    if (assigneeDirty && !canReassignLead) {
      toast.error('You do not have permission to reassign this lead')
      return
    }

    if (statusDirty && !canUpdateLeadStatus) {
      toast.error('You do not have permission to update the lead status')
      return
    }

    if ((statusChanged || remarkDirty) && !canEditRemarks) {
      toast.error(
        statusChanged
          ? 'You do not have permission to add the required remark for this status change'
          : 'You do not have permission to add a remark for this lead'
      )
      return
    }

    const trimmedPatientName = effectivePatientName.trim()
    const trimmedAlternateNumber = effectiveAlternateNumber.trim()
    const trimmedWhatsapp = effectiveWhatsapp.trim()
    const trimmedAge = effectiveAge.trim()
    const trimmedSex = effectiveSex.trim()
    const trimmedCity = effectiveCity.trim()
    const trimmedProfession = effectiveProfession.trim()
    const trimmedCategory = effectiveCategory.trim()
    const trimmedModeOfPayment = effectiveModeOfPayment.trim()

    if (trimmedPatientName.length === 0) {
      toast.error('Patient name is required')
      return
    }

    if (statusRequiresCity && trimmedCity.length === 0) {
      toast.error(`City is required for status "${effectiveLeadStatus}"`)
      return
    }

    if (statusRequiresAgeSex && trimmedAge.length === 0) {
      toast.error(`Age is required for status "${effectiveLeadStatus}"`)
      return
    }

    let parsedAge: number | null = null
    if (trimmedAge.length > 0) {
      parsedAge = Number.parseInt(trimmedAge, 10)
      if (!Number.isFinite(parsedAge) || parsedAge < 0) {
        toast.error('Age must be a valid number')
        return
      }
    }

    if (statusRequiresAgeSex && (!Number.isFinite(parsedAge) || Number(parsedAge) <= 0)) {
      toast.error(`Age must be a valid positive number for status "${effectiveLeadStatus}"`)
      return
    }

    if (statusRequiresAgeSex && trimmedSex.length === 0) {
      toast.error(`Sex is required for status "${effectiveLeadStatus}"`)
      return
    }

    if (assigneeDirty && effectiveAssigneeId.trim().length === 0) {
      toast.error('Assignee is required')
      return
    }

    if (statusChanged && trimmedStatusChangeRemark.length === 0) {
      toast.error('Remark is required when changing lead status')
      return
    }

    if (statusRequiresFollowUpDate && !effectiveFollowUpDate) {
      toast.error(`Follow-up date is required for status "${effectiveLeadStatus}"`)
      return
    }

    if (shouldValidatePastFollowUpDate && effectiveFollowUpDate < todayDateInputValue) {
      toast.error('Follow-up date cannot be older than today')
      return
    }

    if (statusRequiresModeOfPayment && trimmedModeOfPayment.length === 0) {
      toast.error(`Mode of payment is required for status "${effectiveLeadStatus}"`)
      return
    }

    const payload: Record<string, string | number | null> = {}

    if (effectivePatientName !== lead.patientName) {
      payload.patientName = trimmedPatientName
    }

    if (alternateNumberChanged) {
      payload.alternateNumber = trimmedAlternateNumber || null
    }

    if (effectiveWhatsapp !== (lead.whatsapp ?? '')) {
      payload.whatsapp = trimmedWhatsapp || null
    }

    if (effectiveSurgeryDate !== toDateInputValue(currentSurgeryDate)) {
      payload.surgeryDate = effectiveSurgeryDate || null
    }

    if (ageChanged) {
      payload.age = parsedAge
    }

    if (sexChanged) {
      payload.sex = trimmedSex || null
    }

    if (cityChanged) {
      payload.city = trimmedCity || null
    }

    if (professionChanged) {
      payload.profession = trimmedProfession || null
    }

    if (categoryChanged) {
      payload.category = trimmedCategory || null
    }

    if (categoryChanged || treatmentChanged) {
      payload.treatmentMasterId = effectiveTreatmentMasterId || null
    }

    if (assigneeDirty) {
      payload.bdId = effectiveAssigneeId
    }

    if (statusChanged) {
      payload.status = effectiveLeadStatus
      payload.crmEditFollowUpValidation = 'true'
      payload.requireStatusChangeRemark = 'true'
    }

    if (remarkDirty) {
      payload.statusChangeRemark = trimmedStatusChangeRemark
    }

    if (followUpDateChanged) {
      payload.followUpDate = toCombinedDateTime(effectiveFollowUpDate, effectiveFollowUpTime)
    }

    if (modeOfPaymentChanged) {
      payload.modeOfPayment = trimmedModeOfPayment || null
    }

    if (isSuperAdmin && subStatusChanged) {
      payload.subStatus = effectiveSubStatus.trim() || null
    }

    if (Object.keys(payload).length === 0) {
      return
    }

    setSaving(true)
    try {
      await apiPatch(`/api/leads/${leadId}`, payload)
      toast.success('Lead updated')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-edit-drawer', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-ownership-meta', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-remarks', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-activity', leadId] })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} disableBackClose>
      <SheetContent side="right" className="flex h-full w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <SheetHeader className="shrink-0 border-b px-4 py-4 text-left">
          <SheetTitle>
            {lead ? `${lead.patientName} · ${lead.leadRef}` : 'Edit lead'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
              Loading lead editor...
            </div>
          ) : error || !lead ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {error?.message ?? 'We could not load this lead right now.'}
            </div>
          ) : (
            <div className="space-y-4">

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Lead Details</CardTitle>
                      <CardDescription>
                        Editing is limited to lead profile details, surgery date, and assignment.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        onClick={handleMakeCall}
                        disabled={makeCallLoading}
                      >
                        {makeCallLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneCall className="h-4 w-4 text-emerald-500" />
                        )}
                        Make Call
                      </Button>
                      <LeadQrPopover
                        leadId={lead.id}
                        phoneNumber={lead.phoneNumber ?? ''}
                        alternateNumber={lead.alternateNumber ?? ''}
                        patientName={lead.patientName}
                        triggerVariant="button"
                        buttonLabel="Lead QR"
                        allowServerSidePhoneLookup
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-patient-name">Patient name</Label>
                      <Input
                        id="drawer-patient-name"
                        value={effectivePatientName}
                        onChange={(e) => setPatientNameDraft(e.target.value)}
                        disabled={!canEditLeadProfile || saving}
                        placeholder="Enter patient name"
                      />
                    </div>

                    {isSuperAdmin ? (
                      <div className="space-y-2">
                        <Label htmlFor="drawer-whatsapp">WhatsApp</Label>
                        <Input
                          id="drawer-whatsapp"
                          value={effectiveWhatsapp}
                          onChange={(e) => setWhatsappDraft(e.target.value)}
                          disabled={!canEditLeadProfile || saving}
                          placeholder="Enter WhatsApp number"
                        />
                      </div>
                    ) : (
                      <ReadonlyField label="WhatsApp" value={formatMaskedPhone(lead.whatsapp)} />
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-surgery-date">Surgery date</Label>
                      <Input
                        id="drawer-surgery-date"
                        type="date"
                        value={effectiveSurgeryDate}
                        onChange={(e) => setSurgeryDateDraft(e.target.value)}
                        disabled={!canEditLeadProfile || saving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-assign-to">Assign to</Label>
                      <Select
                        value={effectiveAssigneeId}
                        onValueChange={setAssigneeIdDraft}
                        disabled={!canReassignLead || saving || assigneeOptions.length === 0}
                      >
                          <SelectTrigger id="drawer-assign-to">
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                        <SelectContent>
                          {assigneeOptions.map((assignableUser) => (
                            <SelectItem key={assignableUser.id} value={assignableUser.id}>
                              {formatLeadAssigneeName(assignableUser.name, assignableUser.email)}
                              {assignableUser.role
                                ? ` · ${formatLeadAssigneeRoleLabel(assignableUser.role)}`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-age">
                        Age
                        {statusRequiresAgeSex ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Input
                        id="drawer-age"
                        type="number"
                        min={1}
                        value={effectiveAge}
                        onChange={(e) => setAgeDraft(e.target.value)}
                        disabled={!canEditLeadProfile || saving}
                        placeholder="Enter age"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-sex">
                        Sex
                        {statusRequiresAgeSex ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Select
                        value={effectiveSex || '__none__'}
                        onValueChange={(value) => setSexDraft(value === '__none__' ? '' : value)}
                        disabled={!canEditLeadProfile || saving}
                      >
                        <SelectTrigger id="drawer-sex">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select sex</SelectItem>
                          {CRM_LEAD_SEX_OPTIONS.map((sexOption) => (
                            <SelectItem key={sexOption} value={sexOption}>
                              {sexOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-city">
                        City
                        {statusRequiresCity ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Input
                        id="drawer-city"
                        value={effectiveCity}
                        onChange={(e) => setCityDraft(e.target.value)}
                        disabled={!canEditLeadProfile || saving}
                        placeholder="Enter city"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-profession">Profession</Label>
                      <Input
                        id="drawer-profession"
                        value={effectiveProfession}
                        onChange={(e) => setProfessionDraft(e.target.value)}
                        disabled={!canEditLeadProfile || saving}
                        placeholder="Enter profession"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-category">Category</Label>
                      <Select
                        value={effectiveCategory || '__none__'}
                        onValueChange={(value) => {
                          setCategoryDraft(value === '__none__' ? '' : value)
                          setTreatmentMasterIdDraft('')
                        }}
                        disabled={!canEditLeadProfile || saving}
                      >
                        <SelectTrigger id="drawer-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No category</SelectItem>
                          {categoryOptions.map((categoryOption) => (
                            <SelectItem key={categoryOption.id} value={categoryOption.name}>
                              {categoryOption.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-treatment">Treatment</Label>
                      <Select
                        value={effectiveTreatmentMasterId || '__none__'}
                        onValueChange={(value) =>
                          setTreatmentMasterIdDraft(value === '__none__' ? '' : value)
                        }
                        disabled={!canEditLeadProfile || saving}
                      >
                        <SelectTrigger id="drawer-treatment">
                          <SelectValue placeholder="Select treatment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No treatment</SelectItem>
                          {treatmentOptions.map((treatmentOption) => (
                            <SelectItem key={treatmentOption.id} value={treatmentOption.id}>
                              {treatmentOption.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ReadonlyField label="Phone" value={formatMaskedPhone(lead.phoneNumber)} />
                    {isSuperAdmin ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="drawer-alternate-number" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alternate Phone</Label>
                        <Input
                          id="drawer-alternate-number"
                          value={effectiveAlternateNumber}
                          onChange={(e) => setAlternateNumberDraft(e.target.value)}
                          disabled={!canEditLeadProfile || saving}
                          placeholder="Enter alternate phone number"
                        />
                      </div>
                    ) : (
                      <ReadonlyField label="Alternate Phone" value={formatMaskedPhone(lead.alternateNumber)} />
                    )}
                    <ReadonlyField label="Circle" value={formatDisplayValue(lead.circle)} />
                    <ReadonlyField label="Current Owner" value={currentAssigneeName} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status Workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-lead-status">Lead status</Label>
                      <Popover
                        open={leadStatusOpen}
                        onOpenChange={(open) => {
                          setLeadStatusOpen(open)
                          if (!open) {
                            setLeadStatusSearch('')
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            id="drawer-lead-status"
                            disabled={!canUpdateLeadStatus || saving}
                            className="w-full justify-between font-normal"
                            onClick={() => {
                              if (!leadStatusOpen) {
                                setLeadStatusSearch('')
                              }
                            }}
                          >
                            <span className="truncate text-left">
                              {effectiveLeadStatus || 'Search status'}
                            </span>
                            <span className="ml-2 shrink-0">
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          portalled={false}
                          align="start"
                          sideOffset={6}
                          onOpenAutoFocus={(event) => event.preventDefault()}
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                        >
                          <div className="border-b p-2">
                            <Input
                              ref={leadStatusSearchInputRef}
                              value={leadStatusSearch}
                              onChange={(event) => setLeadStatusSearch(event.target.value)}
                              placeholder="Search status"
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  setLeadStatusOpen(false)
                                }
                              }}
                            />
                          </div>
                          <div
                            className="max-h-60 overflow-y-auto overscroll-contain p-1"
                            onWheelCapture={(event) => {
                              event.stopPropagation()
                            }}
                            onTouchMoveCapture={(event) => {
                              event.stopPropagation()
                            }}
                          >
                            {filteredStatusOptions.length > 0 ? (
                              filteredStatusOptions.map((statusOption) => {
                                const isSelected = statusOption === effectiveLeadStatus
                                const isWorkflowManaged = isWorkflowManagedLeadStatus(statusOption)

                                return (
                                  <button
                                    key={statusOption}
                                    type="button"
                                    disabled={isWorkflowManaged}
                                    title={isWorkflowManaged ? 'Managed by the OPD/IPD case workflow' : undefined}
                                    className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm ${
                                      isSelected
                                        ? 'bg-blue-600 text-white disabled:opacity-70'
                                        : 'hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
                                    }`}
                                    onMouseDown={(event) => {
                                      if (isWorkflowManaged) return
                                      event.preventDefault()
                                      setLeadStatusDraft(statusOption)
                                      setLeadStatusSearch('')
                                      setLeadStatusOpen(false)
                                    }}
                                  >
                                    <span>{statusOption}</span>
                                    {isSelected ? <Check className="h-4 w-4" /> : null}
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-3 text-sm text-muted-foreground">
                                No statuses found.
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-follow-up-date">
                        Follow-up date
                        {statusRequiresFollowUpDate ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Input
                        id="drawer-follow-up-date"
                        type="date"
                        value={effectiveFollowUpDate}
                        min={todayDateInputValue}
                        onChange={(e) => setFollowUpDateDraft(e.target.value)}
                        disabled={!canUpdateLeadStatus || saving}
                        className="h-10 w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-follow-up-time">
                        Follow-up time <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="drawer-follow-up-time"
                        type="time"
                        value={effectiveFollowUpTime}
                        onChange={(e) => setFollowUpTimeDraft(e.target.value)}
                        disabled={!canUpdateLeadStatus || saving || !effectiveFollowUpDate}
                        className="h-10 w-full"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-mode-of-payment">
                        Mode of Payment
                        {statusRequiresModeOfPayment ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Select
                        value={effectiveModeOfPayment || '__none__'}
                        onValueChange={(value) =>
                          setModeOfPaymentDraft(value === '__none__' ? '' : value)
                        }
                        disabled={!canUpdateLeadStatus || saving}
                      >
                        <SelectTrigger id="drawer-mode-of-payment">
                          <SelectValue placeholder="Select mode of payment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No mode selected</SelectItem>
                          {modeOfPaymentOptions.map((modeOption) => (
                            <SelectItem key={modeOption} value={modeOption}>
                              {modeOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isSuperAdmin && (
                      <div className="space-y-2">
                        <Label htmlFor="drawer-sub-status">Sub status</Label>
                        <Input
                          id="drawer-sub-status"
                          value={effectiveSubStatus}
                          onChange={(e) => setSubStatusDraft(e.target.value)}
                          disabled={saving}
                          placeholder="Enter sub status"
                          maxLength={25}
                        />
                      </div>
                    )}
                  </div>

                  
                  <div className="space-y-2">
                      <Label htmlFor="drawer-status-change-remark">
                        Remark
                        {statusChanged ? <span className="text-destructive"> *</span> : null}
                      </Label>
                    <Textarea
                      id="drawer-status-change-remark"
                      value={statusChangeRemarkDraft}
                      onChange={(e) =>
                        setStatusChangeRemarkDraftState({
                          leadId,
                          baseValue: latestRemarkContent,
                          value: e.target.value,
                        })
                      }
                      disabled={!canEditRemarks || saving}
                      placeholder={
                        statusChanged
                          ? 'Explain why you are changing this lead status'
                          : 'Add a remark for this lead'
                      }
                      rows={4}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Previous Remark (Last)</h3>
                      <p className="text-xs text-muted-foreground">
                        The most recent saved remark for this lead.
                      </p>
                    </div>

                    {isLoadingRemarks ? (
                      <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        Loading previous remark...
                      </div>
                    ) : previousRemark ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-primary/30 bg-muted/20 px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="select-none text-3xl font-bold leading-none text-foreground/80">
                              &ldquo;
                            </span>
                            <p className="pt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                              {previousRemark.content}
                            </p>
                          </div>
                          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback
                                className={`${getAvatarColor(previousRemark.createdBy?.name ?? 'System').bg} ${getAvatarColor(previousRemark.createdBy?.name ?? 'System').text} text-[10px] font-semibold`}
                              >
                                {getInitials(previousRemark.createdBy?.name ?? 'System')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-foreground">
                                  {previousRemark.createdBy?.name ?? 'System'}
                                </p>
                                {previousRemark.source !== 'workspace' ? (
                                  <span className="rounded border border-border/70 bg-muted/60 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Legacy
                                  </span>
                                ) : null}
                              </div>
                              <p>{format(new Date(previousRemark.createdAt), 'd MMM yyyy, h:mm a')}</p>
                            </div>
                          </div>
                        </div>

                        {olderRemarks.length > 0 ? (
                          <div className="space-y-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedRemarksLeadId((current) =>
                                  current === leadId ? null : leadId
                                )
                              }
                              className="w-full sm:w-auto"
                            >
                              {showAllRemarks
                                ? 'Hide remarks history'
                                : `View all remarks (${olderRemarks.length})`}
                            </Button>

                            {showAllRemarks ? (
                              <div className="space-y-3 rounded-xl border bg-muted/10 p-3">
                                {olderRemarks.map((remark) => (
                                  <div
                                    key={remark.id}
                                    className="rounded-lg border bg-background/40 px-4 py-3"
                                  >
                                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                                      {remark.content}
                                    </p>
                                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                                      <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarFallback
                                          className={`${getAvatarColor(remark.createdBy?.name ?? 'System').bg} ${getAvatarColor(remark.createdBy?.name ?? 'System').text} text-[10px] font-semibold`}
                                        >
                                          {getInitials(remark.createdBy?.name ?? 'System')}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-medium text-foreground">
                                            {remark.createdBy?.name ?? 'System'}
                                          </p>
                                          {remark.source !== 'workspace' ? (
                                            <span className="rounded border border-border/70 bg-muted/60 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                                              Legacy
                                            </span>
                                          ) : null}
                                        </div>
                                        <p>{format(new Date(remark.createdAt), 'd MMM yyyy, h:mm a')}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                        No previous remarks yet.
                      </div>
                    )}
                  </div>

                  {canViewAssignmentHistory || canViewActivityLogs ? <Separator /> : null}

                  {canViewAssignmentHistory || canViewActivityLogs ? (
                    <div className="space-y-3">
                      {canViewAssignmentHistory ? (
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-sm font-semibold">Reassignment History</h3>
                            <p className="text-xs text-muted-foreground">
                              Executive-only owner timeline showing the lead assignment chain.
                            </p>
                          </div>

                          <div className="rounded-xl border bg-muted/20">
                            {isLoadingActivity ? (
                              <div className="px-4 py-6 text-sm text-muted-foreground">
                                Loading reassignment history...
                              </div>
                            ) : assignmentHistory.length === 0 ? (
                              <div className="px-4 py-6 text-sm text-muted-foreground">
                                No reassignment history available yet.
                              </div>
                            ) : (
                              <div className="divide-y">
                                {assignmentHistory.map((entry, index) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-start gap-3 px-4 py-3"
                                  >
                                    <div className="mt-0.5 shrink-0 rounded-full border border-border/70 bg-background/60 p-2">
                                      <UserRoundPlus className="h-4 w-4 text-violet-400" />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <p className="text-sm leading-6 text-foreground">
                                        {index + 1}. {entry.assignedTo.name ?? 'Unknown user'}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                        <span>Assigned on {format(new Date(entry.assignedAt), 'd MMM yyyy, h:mm a')}</span>
                                        {entry.previousAssignedTo?.name ? (
                                          <span>
                                            From {entry.previousAssignedTo.name}
                                          </span>
                                        ) : null}
                                        {entry.changedBy?.name ? (
                                          <span>
                                            By {entry.changedBy.name}
                                            {entry.changedBy.role ? ` · ${formatLeadAssigneeRoleLabel(entry.changedBy.role)}` : ''}
                                          </span>
                                        ) : null}
                                        {entry.automatic ? <span>Automatic</span> : null}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {entry.summary}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {canViewActivityLogs ? (
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-sm font-semibold">Activity Logs</h3>
                            <p className="text-xs text-muted-foreground">
                              Recent lead status, remark, call, and assignment activity.
                            </p>
                          </div>

                          <div className="rounded-xl border bg-muted/20">
                            {isLoadingActivity ? (
                              <div className="px-4 py-6 text-sm text-muted-foreground">
                                Loading activity logs...
                              </div>
                            ) : activityLogs.length === 0 ? (
                              <div className="px-4 py-6 text-sm text-muted-foreground">
                                No activity logs available yet.
                              </div>
                            ) : (
                              <div className="divide-y">
                                {activityLogs.map((activityLog) => {
                                  const actorName =
                                    activityLog.actorUser?.name ||
                                    activityLog.actorUser?.email ||
                                    'System'
                                  const actorRole = formatLeadAssigneeRoleLabel(activityLog.actorRole)

                                  return (
                                    <div
                                      key={activityLog.id}
                                      className="flex items-start gap-3 px-4 py-3"
                                    >
                                      <div className="mt-0.5 shrink-0 rounded-full border border-border/70 bg-background/60 p-2">
                                        <ActivityIcon action={activityLog.action} />
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <p className="text-sm leading-6 text-foreground">
                                          {activityLog.summary}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                          <span className="font-medium text-foreground">{actorName}</span>
                                          {actorRole ? <span>{actorRole}</span> : null}
                                          <span>{format(new Date(activityLog.createdAt), 'd MMM yyyy, h:mm a')}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                      {lead?.id ? (
                        <KnowlarityCallRecordingsCard leadId={lead.id} className="mt-4" />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t px-4 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveDisabled}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
