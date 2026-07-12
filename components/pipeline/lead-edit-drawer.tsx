'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { LEAD_STATUS_OPTIONS } from '@/lib/lead-status-options'
import { getRoleLabel } from '@/lib/roles'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type LeadEditLead = {
  id: string
  leadRef: string
  patientName: string
  treatment?: string | null
  diseaseDetails?: string | null
  status?: string | null
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
  const [treatmentDraft, setTreatmentDraft] = useState<string | null>(null)
  const [diseaseDraft, setDiseaseDraft] = useState<string | null>(null)
  const [leadStatusDraft, setLeadStatusDraft] = useState<string | null>(null)
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
  const effectiveTreatment = treatmentDraft ?? (lead?.treatment ?? '')
  const effectiveDisease = diseaseDraft ?? (lead?.diseaseDetails ?? '')
  const effectiveLeadStatus = leadStatusDraft ?? (lead?.status ?? 'New')
  const willAutoReassign =
    effectiveLeadStatus.trim().toLowerCase() === 'junk' ||
    effectiveLeadStatus.trim().toLowerCase() === 'churned'

  const canEditLeadProfile = leadOwnershipMeta?.canEditLeadProfile ?? false
  const canUpdateLeadStatus = leadOwnershipMeta?.canUpdateStatus ?? false
  const canReassignLead = leadOwnershipMeta?.canReassign ?? false
  const assignableLeadUsers = leadOwnershipMeta?.assignableUsers ?? []
  const isBdRole = user?.role === 'BD'

  const isDirty =
    effectivePatientName !== (lead?.patientName ?? '') ||
    effectiveTreatment !== (lead?.treatment ?? '') ||
    effectiveDisease !== (lead?.diseaseDetails ?? '') ||
    effectiveLeadStatus !== (lead?.status ?? 'New') ||
    leadAssigneeDraft.length > 0

  async function handleSave() {
    if (!leadId || !lead) return

    const payload: Record<string, string | null> = {}

    if (effectivePatientName !== lead.patientName) {
      payload.patientName = effectivePatientName.trim()
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
                      ? 'Edits are limited to the leads you own or manage within your hierarchy scope.'
                      : 'Your role cannot edit patient name, disease, or treatment for this lead.'}
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
                        }}
                        disabled={!canUpdateLeadStatus || saving}
                      >
                        <SelectTrigger id="drawer-lead-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUS_OPTIONS.map((statusOption) => (
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
