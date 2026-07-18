'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch } from '@/lib/api-client'
import { normalizeLeadSexValue } from '@/lib/lead-sex'
import { LEAD_STATUS_OPTIONS } from '@/lib/lead-status-options'
import {
  isStatusRequiringAgeSex,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const CRM_LEAD_SEX_OPTIONS = ['Male', 'Female', 'Other'] as const
const MODE_OF_PAYMENT_OPTIONS = ['Cash', 'Cashless', 'EMI', 'Reimbursement'] as const
const CRM_ADDITIONAL_STATUS_OPTIONS = [
  'DNP-1',
  'DNP-2',
  'DNP-3',
  'DNP-4',
  'DNP-5',
  'DNP Exhausted',
] as const

const CRM_EDIT_LEAD_STATUS_OPTIONS = [
  ...new Set([...LEAD_STATUS_OPTIONS, ...CRM_ADDITIONAL_STATUS_OPTIONS]),
]

function formatDisplayValue(value: unknown, fallback = '—') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'yyyy-MM-dd')
}

type LeadEditLead = {
  id: string
  leadRef: string
  patientName: string
  phoneNumber?: string | null
  alternateNumber?: string | null
  whatsapp?: string | null
  age?: number | null
  sex?: string | null
  treatment?: string | null
  diseaseDetails?: string | null
  status?: string | null
  followUpDate?: string | null
  modeOfPayment?: string | null
  circle?: string | null
  category?: string | null
  hospitalName?: string | null
  source?: string | null
  campaignName?: string | null
  month?: string | null
  surgeryDate?: string | null
  address?: string | null
  bd?: {
    id: string
    name: string
  } | null
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

export function LeadEditDrawer({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [patientNameDraft, setPatientNameDraft] = useState<string | null>(null)
  const [whatsappDraft, setWhatsappDraft] = useState<string | null>(null)
  const [surgeryDateDraft, setSurgeryDateDraft] = useState<string | null>(null)
  const [assigneeIdDraft, setAssigneeIdDraft] = useState<string | null>(null)
  const [ageDraft, setAgeDraft] = useState<string | null>(null)
  const [sexDraft, setSexDraft] = useState<string | null>(null)
  const [leadStatusDraft, setLeadStatusDraft] = useState<string | null>(null)
  const [followUpDateDraft, setFollowUpDateDraft] = useState<string | null>(null)
  const [modeOfPaymentDraft, setModeOfPaymentDraft] = useState<string | null>(null)
  const [statusChangeRemarkDraft, setStatusChangeRemarkDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: lead, isLoading, error } = useQuery<LeadEditLead, Error>({
    queryKey: ['lead-edit-drawer', leadId],
    queryFn: () => apiGet<LeadEditLead>(`/api/leads/${leadId}`),
    enabled: open && !!leadId,
    retry: false,
  })

  const { data: leadOwnershipMeta, isLoading: isLoadingMeta } = useQuery<LeadOwnershipMeta, Error>({
    queryKey: ['lead-ownership-meta', leadId],
    queryFn: () => apiGet<LeadOwnershipMeta>(`/api/leads/${leadId}/assignable-users`),
    enabled: open && !!leadId,
    retry: false,
  })

  const effectivePatientName = patientNameDraft ?? lead?.patientName ?? ''
  const effectiveWhatsapp = whatsappDraft ?? (lead?.whatsapp ?? '')
  const effectiveSurgeryDate = surgeryDateDraft ?? toDateInputValue(lead?.surgeryDate)
  const effectiveAssigneeId = assigneeIdDraft ?? leadOwnershipMeta?.currentAssigneeId ?? lead?.bd?.id ?? ''
  const effectiveAge = ageDraft ?? (lead?.age == null ? '' : String(lead.age))
  const currentNormalizedSex = normalizeLeadSexValue(lead?.sex)
  const effectiveSex = sexDraft ?? currentNormalizedSex
  const effectiveLeadStatus = leadStatusDraft ?? (lead?.status ?? 'New')
  const effectiveFollowUpDate = followUpDateDraft ?? toDateInputValue(lead?.followUpDate)
  const effectiveModeOfPayment = modeOfPaymentDraft ?? (lead?.modeOfPayment ?? '')

  const canEditLeadProfile = leadOwnershipMeta?.canEditLeadProfile ?? false
  const canEditRemarks = leadOwnershipMeta?.canEditRemarks ?? false
  const canUpdateLeadStatus = leadOwnershipMeta?.canUpdateStatus ?? false
  const canReassignLead = leadOwnershipMeta?.canReassign ?? false
  const currentAssigneeId = leadOwnershipMeta?.currentAssigneeId ?? lead?.bd?.id ?? ''
  const currentAssigneeName =
    lead?.bd?.name ??
    leadOwnershipMeta?.assignableUsers.find((assignableUser) => assignableUser.id === currentAssigneeId)?.name ??
    'Unassigned'

  const currentStatus = lead?.status ?? 'New'
  const currentFollowUpDate = toDateInputValue(lead?.followUpDate)
  const currentModeOfPayment = lead?.modeOfPayment ?? ''
  const trimmedStatusChangeRemark = statusChangeRemarkDraft.trim()

  const statusChanged = effectiveLeadStatus !== currentStatus
  const followUpDateChanged = effectiveFollowUpDate !== currentFollowUpDate
  const modeOfPaymentChanged = effectiveModeOfPayment !== currentModeOfPayment
  const statusRequiresFollowUpDate = isStatusRequiringFollowUpDate(effectiveLeadStatus)
  const statusRequiresAgeSex = isStatusRequiringAgeSex(effectiveLeadStatus)
  const statusRequiresModeOfPayment = isStatusRequiringModeOfPayment(effectiveLeadStatus)

  const profileDirty =
    effectivePatientName !== (lead?.patientName ?? '') ||
    effectiveWhatsapp !== (lead?.whatsapp ?? '') ||
    effectiveSurgeryDate !== toDateInputValue(lead?.surgeryDate)
  const assigneeDirty = effectiveAssigneeId !== currentAssigneeId

  const statusDirty = statusChanged || followUpDateChanged || modeOfPaymentChanged
  const isDirty = profileDirty || assigneeDirty || statusDirty

  const statusOptions = Array.from(
    new Set(
      effectiveLeadStatus && effectiveLeadStatus.trim().length > 0
        ? [effectiveLeadStatus, ...CRM_EDIT_LEAD_STATUS_OPTIONS]
        : CRM_EDIT_LEAD_STATUS_OPTIONS
    )
  )

  const modeOfPaymentOptions = Array.from(
    new Set(
      effectiveModeOfPayment && effectiveModeOfPayment.trim().length > 0
        ? [effectiveModeOfPayment, ...MODE_OF_PAYMENT_OPTIONS]
        : MODE_OF_PAYMENT_OPTIONS
    )
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

    if (statusChanged && !canEditRemarks) {
      toast.error('You do not have permission to add the required remark for this status change')
      return
    }

    const trimmedPatientName = effectivePatientName.trim()
    const trimmedWhatsapp = effectiveWhatsapp.trim()
    const trimmedAge = effectiveAge.trim()
    const trimmedSex = effectiveSex.trim()
    const trimmedModeOfPayment = effectiveModeOfPayment.trim()

    if (trimmedPatientName.length === 0) {
      toast.error('Patient name is required')
      return
    }

    const requiresAgeSexForStatusChange = statusChanged && statusRequiresAgeSex

    if (requiresAgeSexForStatusChange && trimmedAge.length === 0) {
      toast.error('Age is required')
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

    if (requiresAgeSexForStatusChange && (!Number.isFinite(parsedAge) || Number(parsedAge) <= 0)) {
      toast.error('Age must be a valid positive number')
      return
    }

    if (requiresAgeSexForStatusChange && trimmedSex.length === 0) {
      toast.error('Sex is required')
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

    if (statusChanged && statusRequiresFollowUpDate && !effectiveFollowUpDate) {
      toast.error('Follow-up date is required for follow-up and DNP statuses')
      return
    }

    if (statusChanged && statusRequiresModeOfPayment && trimmedModeOfPayment.length === 0) {
      toast.error('Mode of payment is required for Follow-up and Follow-up 1-5 statuses')
      return
    }

    const payload: Record<string, string | number | null> = {}

    if (effectivePatientName !== lead.patientName) {
      payload.patientName = trimmedPatientName
    }

    if (effectiveWhatsapp !== (lead.whatsapp ?? '')) {
      payload.whatsapp = trimmedWhatsapp || null
    }

    if (effectiveSurgeryDate !== toDateInputValue(lead.surgeryDate)) {
      payload.surgeryDate = effectiveSurgeryDate || null
    }

    if (
      requiresAgeSexForStatusChange &&
      effectiveAge !== (lead.age == null ? '' : String(lead.age)) &&
      parsedAge !== null
    ) {
      payload.age = parsedAge
    }

    if (requiresAgeSexForStatusChange && effectiveSex !== currentNormalizedSex && trimmedSex.length > 0) {
      payload.sex = trimmedSex
    }

    if (assigneeDirty) {
      payload.bdId = effectiveAssigneeId
    }

    if (statusChanged) {
      payload.status = effectiveLeadStatus
      payload.crmEditFollowUpValidation = 'true'
      payload.requireStatusChangeRemark = 'true'
      payload.statusChangeRemark = trimmedStatusChangeRemark
    }

    if (followUpDateChanged) {
      payload.followUpDate = effectiveFollowUpDate || null
    }

    if (modeOfPaymentChanged) {
      payload.modeOfPayment = trimmedModeOfPayment || null
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
          <SheetTitle>{lead ? lead.patientName : 'Edit lead'}</SheetTitle>
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
                  <CardTitle className="text-base">Lead Details</CardTitle>
                  <CardDescription>
                    Editing is limited to name, WhatsApp, surgery date, and assignment.
                  </CardDescription>
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
                              {assignableUser.name}
                              {assignableUser.role ? ` · ${assignableUser.role}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ReadonlyField label="Phone" value={formatDisplayValue(lead.phoneNumber)} />
                    <ReadonlyField label="Alternate Phone" value={formatDisplayValue(lead.alternateNumber)} />
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
                      <Select
                        value={effectiveLeadStatus}
                        onValueChange={setLeadStatusDraft}
                        disabled={!canUpdateLeadStatus || saving}
                      >
                        <SelectTrigger id="drawer-lead-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((statusOption) => (
                            <SelectItem key={statusOption} value={statusOption}>
                              {statusOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="drawer-age">
                        Age
                        {statusChanged && statusRequiresAgeSex ? (
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
                        {statusChanged && statusRequiresAgeSex ? (
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
                      <Label htmlFor="drawer-follow-up-date">
                        Follow-up date
                        {statusChanged && statusRequiresFollowUpDate ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Input
                        id="drawer-follow-up-date"
                        type="date"
                        value={effectiveFollowUpDate}
                        onChange={(e) => setFollowUpDateDraft(e.target.value)}
                        disabled={!canUpdateLeadStatus || saving}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="drawer-mode-of-payment">
                        Mode of Payment
                        {statusChanged && statusRequiresModeOfPayment ? (
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
                  </div>

                  
                  <div className="space-y-2">
                    <Label htmlFor="drawer-status-change-remark">
                      Status change remark
                      {statusChanged ? <span className="text-destructive"> *</span> : null}
                    </Label>
                    <Textarea
                      id="drawer-status-change-remark"
                      value={statusChangeRemarkDraft}
                      onChange={(e) => setStatusChangeRemarkDraft(e.target.value)}
                      disabled={!canEditRemarks || saving}
                      placeholder={
                        statusChanged
                          ? 'Explain why you are changing this lead status'
                          : 'This remark becomes mandatory when the status changes'
                      }
                      rows={4}
                    />
                  </div>
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
            disabled={
              saving ||
              isLoading ||
              isLoadingMeta ||
              !lead ||
              !isDirty ||
              (profileDirty && !canEditLeadProfile) ||
              (assigneeDirty && !canReassignLead) ||
              (statusDirty && !canUpdateLeadStatus) ||
              (statusChanged && !canEditRemarks)
            }
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
