'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { LEAD_STATUS_OPTIONS } from '@/lib/lead-status-options'
import { getRoleLabel } from '@/lib/roles'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { CalendarIcon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

const CRM_ADDITIONAL_LEAD_STATUS_OPTIONS = [
  'Not Interested',
  'Nurture',
  'Nurture1',
  'Nurture2',
  'Nurture3',
  'Nurture4',
  'Nurture5',
  'OPD Done',
  'OPD Schedule',
  'Order Booked',
  'Out of Station',
  'Out of station follow-up',
  'Policy Booked',
  'Policy Issued',
  'Scan Done',
  'Supply Gap',
  'SX Not Suggested',
  'WA Done',
  'IPD Lost',
  'Language Barrier',
  'Duplicate lead',
  'Already Insured',
  'DNP-1',
  'DNP-2',
  'DNP-3',
  'DNP-4',
  'DNP-5',
  'DNP Exhausted',
] as const

const CRM_EDIT_LEAD_STATUS_OPTIONS = [
  ...new Set([...LEAD_STATUS_OPTIONS, ...CRM_ADDITIONAL_LEAD_STATUS_OPTIONS]),
]

const CRM_LEAD_SEX_OPTIONS = ['Male', 'Female', 'Other'] as const

function isStatusRequiringFollowUpDate(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toLowerCase()
  return normalized.includes('follow-up') || normalized.startsWith('dnp')
}

function isFollowUpStatus(status: string | null | undefined) {
  return String(status ?? '').trim().toLowerCase().includes('follow-up')
}

function parseFollowUpDate(value: string | null | undefined) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

type LeadEditLead = {
  id: string
  leadRef: string
  patientName: string
  age?: number | null
  sex?: string | null
  treatment?: string | null
  diseaseDetails?: string | null
  status?: string | null
  followUpDate?: string | null
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
  canUpdateStatus: boolean
  canReassign: boolean
  currentAssigneeId: string
  assignableUsers: LeadOwnershipUser[]
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
  const { user } = useAuth()
  const [patientNameDraft, setPatientNameDraft] = useState<string | null>(null)
  const [ageDraft, setAgeDraft] = useState<string | null>(null)
  const [sexDraft, setSexDraft] = useState<string | null>(null)
  const [treatmentDraft, setTreatmentDraft] = useState<string | null>(null)
  const [diseaseDraft, setDiseaseDraft] = useState<string | null>(null)
  const [leadStatusDraft, setLeadStatusDraft] = useState<string | null>(null)
  const [followUpDateDraft, setFollowUpDateDraft] = useState<string | null>(null)
  const [leadAssigneeDraft, setLeadAssigneeDraft] = useState('')
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
  const effectiveAge = ageDraft ?? (lead?.age == null ? '' : String(lead.age))
  const effectiveSex = sexDraft ?? (lead?.sex ?? '')
  const effectiveTreatment = treatmentDraft ?? (lead?.treatment ?? '')
  const effectiveDisease = diseaseDraft ?? (lead?.diseaseDetails ?? '')
  const effectiveLeadStatus = leadStatusDraft ?? (lead?.status ?? 'New')
  const effectiveFollowUpDate = followUpDateDraft ?? (lead?.followUpDate ?? '')
  const willAutoReassign =
    effectiveLeadStatus.trim().toLowerCase() === 'junk' ||
    effectiveLeadStatus.trim().toLowerCase() === 'churned'
  const statusRequiresFollowUpDate = isStatusRequiringFollowUpDate(effectiveLeadStatus)
  const statusRequiresAgeSex = isFollowUpStatus(effectiveLeadStatus)
  const statusChanged = effectiveLeadStatus !== (lead?.status ?? 'New')
  const shouldRequireFollowUpDate = statusChanged && statusRequiresFollowUpDate
  const shouldRequireAgeSex = statusChanged && statusRequiresAgeSex
  const parsedEffectiveFollowUpDate = parseFollowUpDate(effectiveFollowUpDate)

  const canEditLeadProfile = leadOwnershipMeta?.canEditLeadProfile ?? false
  const canUpdateLeadStatus = leadOwnershipMeta?.canUpdateStatus ?? false
  const canReassignLead = leadOwnershipMeta?.canReassign ?? false
  const assignableLeadUsers = leadOwnershipMeta?.assignableUsers ?? []
  const isBdRole = user?.role === 'BD'

  const isDirty =
    effectivePatientName !== (lead?.patientName ?? '') ||
    effectiveAge !== (lead?.age == null ? '' : String(lead.age)) ||
    effectiveSex !== (lead?.sex ?? '') ||
    effectiveTreatment !== (lead?.treatment ?? '') ||
    effectiveDisease !== (lead?.diseaseDetails ?? '') ||
    effectiveLeadStatus !== (lead?.status ?? 'New') ||
    effectiveFollowUpDate !== (lead?.followUpDate ?? '') ||
    leadAssigneeDraft.length > 0

  async function handleSave() {
    if (!leadId || !lead) return

    const payload: Record<string, string | number | null> = {}

    if (effectivePatientName !== lead.patientName) {
      payload.patientName = effectivePatientName.trim()
    }

    if (effectiveAge !== (lead.age == null ? '' : String(lead.age))) {
      const trimmedAge = effectiveAge.trim()
      payload.age = trimmedAge ? Number.parseInt(trimmedAge, 10) : null
    }

    if (effectiveSex !== (lead.sex ?? '')) {
      payload.sex = effectiveSex.trim() || null
    }

    if (effectiveTreatment !== (lead.treatment ?? '')) {
      payload.treatment = effectiveTreatment.trim() || null
    }

    if (effectiveDisease !== (lead.diseaseDetails ?? '')) {
      payload.diseaseDetails = effectiveDisease.trim() || null
    }

    if (effectiveLeadStatus !== (lead.status ?? 'New')) {
      payload.status = effectiveLeadStatus
    }

    if (effectiveFollowUpDate !== (lead.followUpDate ?? '')) {
      payload.followUpDate = effectiveFollowUpDate || null
    }

    if (leadAssigneeDraft) {
      payload.bdId = leadAssigneeDraft
    }

    if (Object.keys(payload).length === 0) {
      return
    }

    if (typeof payload.patientName === 'string' && payload.patientName.trim().length === 0) {
      toast.error('Patient name is required')
      return
    }

    if (effectiveAge.trim().length > 0) {
      const parsedAge = Number.parseInt(effectiveAge.trim(), 10)
      if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
        toast.error('Age must be a valid positive number')
        return
      }
    }

    if (shouldRequireFollowUpDate && !effectiveFollowUpDate) {
      toast.error('Follow-up date is required for DNP and follow-up statuses')
      return
    }

    if (shouldRequireAgeSex && (effectiveAge.trim().length === 0 || effectiveSex.trim().length === 0)) {
      toast.error('Age and sex are required for follow-up statuses')
      return
    }

    payload.crmEditFollowUpValidation = 'true'

    setSaving(true)
    try {
      await apiPatch(`/api/leads/${leadId}`, payload)
      toast.success('Lead updated')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 gap-0 flex flex-col">
        <SheetHeader className="border-b">
          <SheetTitle>{lead ? `${lead.patientName}` : 'Edit lead'}</SheetTitle>
          <SheetDescription>
            {lead ? `${lead.leadRef} · Update patient details and lead ownership from one drawer.` : 'Loading lead editor...'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
              Loading lead editor...
            </div>
          ) : error || !lead ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {error?.message ?? 'We could not load this lead right now.'}
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Patient Details</CardTitle>
                  <CardDescription>
                    Edit patient name, disease, and treatment when your lead scope allows it.
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
                      <Label htmlFor="drawer-treatment">Treatment</Label>
                      <Input
                        id="drawer-treatment"
                        value={effectiveTreatment}
                        onChange={(e) => setTreatmentDraft(e.target.value)}
                        disabled={!canEditLeadProfile || saving}
                        placeholder="Enter treatment"
                      />
                    </div>
                  </div>

                  {statusRequiresAgeSex && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="drawer-age">Age</Label>
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
                        <Label htmlFor="drawer-sex">Sex</Label>
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
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="drawer-disease">Disease</Label>
                    <Textarea
                      id="drawer-disease"
                      value={effectiveDisease}
                      onChange={(e) => setDiseaseDraft(e.target.value)}
                      disabled={!canEditLeadProfile || saving}
                      placeholder="Enter disease details"
                      rows={4}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {canEditLeadProfile
                      ? statusRequiresAgeSex
                        ? 'Follow-up statuses require age and sex in this CRM edit flow.'
                        : 'Edits are limited to the leads you own or manage within your hierarchy scope.'
                      : 'Your role cannot edit patient name, disease, age, sex, or treatment for this lead.'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {isBdRole ? 'Lead Status' : 'Lead Transfer'}
                  </CardTitle>
                  <CardDescription>
                    {isBdRole
                      ? 'Update the sales status for this lead.'
                      : 'Update the sales status and, when your role allows it, transfer this lead to another owner without changing campaign mapping.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`grid gap-4 ${isBdRole ? '' : 'md:grid-cols-2'}`}>
                    <div className="space-y-2">
                      <Label htmlFor="drawer-lead-status">Lead status</Label>
                      <Select
                        value={effectiveLeadStatus}
                        onValueChange={(value) => {
                          setLeadStatusDraft(value)
                          if (value.trim().toLowerCase() === 'junk' || value.trim().toLowerCase() === 'churned') {
                            setLeadAssigneeDraft('')
                          }
                          if (!isFollowUpStatus(value)) {
                            setAgeDraft(null)
                            setSexDraft(null)
                          }
                          if (!isStatusRequiringFollowUpDate(value)) {
                            setFollowUpDateDraft('')
                          }
                        }}
                        disabled={!canUpdateLeadStatus || saving}
                      >
                        <SelectTrigger id="drawer-lead-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_EDIT_LEAD_STATUS_OPTIONS.map((statusOption) => (
                            <SelectItem key={statusOption} value={statusOption}>
                              {statusOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {canUpdateLeadStatus
                          ? 'You can update the current sales status for this lead.'
                          : 'Your role cannot change the lead status for this record.'}
                      </p>
                    </div>

                    {statusRequiresFollowUpDate && (
                      <div className="space-y-2">
                        <Label>Follow-up date</Label>
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 justify-start text-left font-normal"
                                disabled={!canUpdateLeadStatus || saving}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                                {parsedEffectiveFollowUpDate
                                  ? format(parsedEffectiveFollowUpDate, 'PPP')
                                  : 'Pick follow-up date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={parsedEffectiveFollowUpDate}
                                onSelect={(date) =>
                                  setFollowUpDateDraft(date ? format(date, 'yyyy-MM-dd') : '')
                                }
                                defaultMonth={parsedEffectiveFollowUpDate ?? new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                          {effectiveFollowUpDate ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={!canUpdateLeadStatus || saving}
                              onClick={() => setFollowUpDateDraft('')}
                              aria-label="Clear follow-up date"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {shouldRequireFollowUpDate
                            ? 'A follow-up date is required when you move this lead into a DNP or follow-up status.'
                            : 'This status family carries a follow-up date in the CRM edit flow.'}
                        </p>
                      </div>
                    )}

                    {!isBdRole && (
                      <div className="space-y-2">
                        <Label htmlFor="drawer-lead-assignee">Transfer lead</Label>
                        <Select
                          value={leadAssigneeDraft || '__none__'}
                          onValueChange={(value) =>
                            setLeadAssigneeDraft(value === '__none__' ? '' : value)
                          }
                          disabled={!canReassignLead || saving || willAutoReassign}
                        >
                          <SelectTrigger id="drawer-lead-assignee">
                            <SelectValue placeholder="Keep current owner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Keep current owner</SelectItem>
                            {assignableLeadUsers.map((assignableUser) => (
                              <SelectItem key={assignableUser.id} value={assignableUser.id}>
                                {assignableUser.name} · {getRoleLabel(assignableUser.role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Current owner: {lead.bd?.name ?? 'Unassigned'}
                          {willAutoReassign
                            ? ' · Junk and Churned leads are reassigned automatically to another BD in the same team.'
                            : canReassignLead
                            ? ' · Choose any allowed owner when you want to transfer this lead. The lead ID and campaign name stay intact.'
                            : ' · Lead transfer is not available for your role on this lead.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {isLoadingMeta ? (
                    <p className="text-xs text-muted-foreground">Loading ownership rules...</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Status updates and transfer permissions follow your role scope automatically.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <SheetFooter className="border-t">
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
              (shouldRequireAgeSex &&
                (!canEditLeadProfile ||
                  effectiveAge.trim().length === 0 ||
                  effectiveSex.trim().length === 0)) ||
              (shouldRequireFollowUpDate && !effectiveFollowUpDate) ||
              effectivePatientName.trim().length === 0
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
