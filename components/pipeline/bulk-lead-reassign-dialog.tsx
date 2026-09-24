'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  CRM_LEAD_STATUS_OPTIONS,
  CRM_MODE_OF_PAYMENT_OPTIONS,
} from '@/lib/lead-status-options'
import {
  formatLeadAssigneeName,
  formatLeadAssigneeRoleLabel,
} from '@/lib/lead-assignee-display'
import { cn } from '@/lib/utils'

type AssignableUser = {
  id: string
  name: string
  email: string
  role: string
}

type SelectedLead = {
  id: number
  leadRef?: string
  patientName?: string
}

export function BulkLeadReassignDialog({
  open,
  onOpenChange,
  leadOptions,
  selectedLeadIds,
  onSelectedLeadIdsChange,
  selectedLeads,
  assignableUsers,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadOptions: SelectedLead[]
  selectedLeadIds: number[]
  onSelectedLeadIdsChange: (leadIds: number[]) => void
  selectedLeads: SelectedLead[]
  assignableUsers: AssignableUser[]
  isPending: boolean
  onSubmit: (payload: {
    bdUserIds: string[]
    removePreviousRemarks: boolean
    removePreviousFollowUpDate?: boolean
    leadStatus?: string
    followUpDate?: string
    modeOfPayment?: string
    subStatus?: string
    pauseSeconds?: number
  }) => Promise<unknown> | void
}) {
  const [selectedBdUserIds, setSelectedBdUserIds] = useState<string[]>([])
  const [removePreviousRemarks, setRemovePreviousRemarks] = useState(false)
  const [removePreviousFollowUpDate, setRemovePreviousFollowUpDate] = useState(false)
  const [leadStatus, setLeadStatus] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')
  const [modeOfPayment, setModeOfPayment] = useState('')
  const [subStatus, setSubStatus] = useState('')
  const [pauseSeconds, setPauseSeconds] = useState('')
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [leadQuery, setLeadQuery] = useState('')
  const [bdPickerOpen, setBdPickerOpen] = useState(false)
  const [bdQuery, setBdQuery] = useState('')
  const reassignableUsers = useMemo(() => assignableUsers, [assignableUsers])

  const selectedLeadSummary = useMemo(
    () =>
      selectedLeads
        .map((lead) => lead.leadRef || lead.patientName || lead.id)
        .filter(Boolean)
        .join(', '),
    [selectedLeads]
  )

  const filteredLeadOptions = useMemo(() => {
    const query = leadQuery.trim().toLowerCase()
    if (!query) return leadOptions

    return leadOptions.filter((lead) => {
      const label = `${lead.leadRef || ''} ${lead.patientName || ''}`.toLowerCase()
      return label.includes(query)
    })
  }, [leadOptions, leadQuery])

  const selectedLeadButtonLabel = useMemo(() => {
    if (selectedLeads.length === 0) return 'Select leads'
    if (selectedLeads.length === 1) return selectedLeads[0]?.leadRef || selectedLeads[0]?.patientName || '1 lead selected'
    return `${selectedLeads.length} leads selected`
  }, [selectedLeads])

  const allDialogLeadsSelected = leadOptions.length > 0 && selectedLeadIds.length === leadOptions.length
  const selectedBdUsers = useMemo(
    () =>
      selectedBdUserIds
        .map((userId) => reassignableUsers.find((user) => user.id === userId))
        .filter((user): user is AssignableUser => Boolean(user)),
    [reassignableUsers, selectedBdUserIds]
  )

  const filteredAssignableUsers = useMemo(() => {
    const query = bdQuery.trim().toLowerCase()
    if (!query) return reassignableUsers

    return reassignableUsers.filter((user) => {
      const label = `${formatLeadAssigneeName(user.name, user.email)} ${user.email} ${formatLeadAssigneeRoleLabel(user.role) ?? ''}`.toLowerCase()
      return label.includes(query)
    })
  }, [reassignableUsers, bdQuery])

  const selectedBdButtonLabel = useMemo(() => {
    if (selectedBdUsers.length === 0) return 'Select assignees'
    if (selectedBdUsers.length === 1) {
      return formatLeadAssigneeName(selectedBdUsers[0]?.name, selectedBdUsers[0]?.email)
    }
    return `${selectedBdUsers.length} assignees selected`
  }, [selectedBdUsers])
  const showOptionalWorkflowFields = leadStatus.trim().length > 0

  function handleLeadStatusChange(nextStatus: string) {
    setLeadStatus(nextStatus)
  }

  function toggleLead(leadId: number, checked: boolean) {
    if (checked) {
      onSelectedLeadIdsChange(
        selectedLeadIds.includes(leadId) ? selectedLeadIds : [...selectedLeadIds, leadId]
      )
      return
    }

    onSelectedLeadIdsChange(selectedLeadIds.filter((id) => id !== leadId))
  }

  function toggleBd(userId: string, checked: boolean) {
    if (checked) {
      setSelectedBdUserIds((current) =>
        current.includes(userId) ? current : [...current, userId]
      )
      return
    }

    setSelectedBdUserIds((current) => current.filter((id) => id !== userId))
  }

  async function handleSubmit() {
    const combinedFollowUp = followUpDate.trim().length > 0
      ? (followUpTime.trim().length > 0 ? `${followUpDate.trim()}T${followUpTime.trim()}:00` : followUpDate.trim())
      : ''

    await onSubmit({
      bdUserIds: selectedBdUserIds,
      removePreviousRemarks,
      removePreviousFollowUpDate,
      ...(leadStatus.trim().length > 0 ? { leadStatus: leadStatus.trim() } : {}),
      ...(combinedFollowUp.length > 0
        ? { followUpDate: combinedFollowUp }
        : {}),
      ...(modeOfPayment.trim().length > 0
        ? { modeOfPayment }
        : {}),
      ...(subStatus.trim().length > 0 ? { subStatus: subStatus.trim() } : {}),
      ...(pauseSeconds.trim().length > 0 ? { pauseSeconds: Number(pauseSeconds) } : {}),
    })
    handleOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedBdUserIds([])
      setRemovePreviousRemarks(false)
      setRemovePreviousFollowUpDate(false)
      setLeadStatus('')
      setFollowUpDate('')
      setFollowUpTime('')
      setModeOfPayment('')
      setSubStatus('')
      setPauseSeconds('')
      setLeadPickerOpen(false)
      setLeadQuery('')
      setBdPickerOpen(false)
      setBdQuery('')
    }

    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Lead Reassignment</DialogTitle>
          <DialogDescription>
            Reassign leads in round-robin assignee order and pause after each full cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-reassign-leads">Leads</Label>
            <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="bulk-reassign-leads"
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate text-left">{selectedLeadButtonLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                portalled={false}
                className="w-[var(--radix-popover-trigger-width)] min-w-[320px] overflow-hidden p-0"
                align="start"
              >
                <div className="border-b p-2">
                  <Input
                    value={leadQuery}
                    onChange={(event) => setLeadQuery(event.target.value)}
                    placeholder="Search lead ref or patient"
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      onSelectedLeadIdsChange(allDialogLeadsSelected ? [] : leadOptions.map((lead) => lead.id))
                    }
                  >
                    {allDialogLeadsSelected ? 'Clear all' : 'Select all'}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {selectedLeadIds.length} selected
                  </span>
                </div>
                <ScrollArea className="h-[260px] overscroll-contain">
                  <div className="p-1">
                  {filteredLeadOptions.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No leads found</p>
                  ) : (
                    filteredLeadOptions.map((lead) => {
                      const checked = selectedLeadIds.includes(lead.id)
                      const label = lead.leadRef || lead.patientName || lead.id
                      const description =
                        lead.leadRef && lead.patientName ? lead.patientName : null

                      return (
                        <label
                          key={lead.id}
                          className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleLead(lead.id, value === true)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{label}</span>
                            {description ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {description}
                              </span>
                            ) : null}
                          </span>
                          <Check className={cn('mt-0.5 h-3.5 w-3.5 text-primary', checked ? 'opacity-100' : 'opacity-0')} />
                        </label>
                      )
                    })
                  )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Textarea
              id="bulk-reassign-leads-summary"
              value={selectedLeadSummary}
              readOnly
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {selectedLeads.length} lead{selectedLeads.length === 1 ? '' : 's'} selected
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-reassign-bds">Assign to</Label>
            <Popover open={bdPickerOpen} onOpenChange={setBdPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="bulk-reassign-bds"
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate text-left">{selectedBdButtonLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                portalled={false}
                className="w-[var(--radix-popover-trigger-width)] min-w-[320px] overflow-hidden p-0"
                align="start"
              >
                <div className="border-b p-2">
                  <Input
                    value={bdQuery}
                    onChange={(event) => setBdQuery(event.target.value)}
                    placeholder="Search assignee name or email"
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Selection order is used for round robin
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedBdUserIds.length} selected
                  </span>
                </div>
                <ScrollArea className="h-[260px] overscroll-contain">
                  <div className="p-1">
                  {filteredAssignableUsers.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No assignees found</p>
                  ) : (
                    filteredAssignableUsers.map((assignableUser) => {
                      const checked = selectedBdUserIds.includes(assignableUser.id)
                      return (
                        <label
                          key={assignableUser.id}
                          className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              toggleBd(assignableUser.id, value === true)
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">
                              {formatLeadAssigneeName(assignableUser.name, assignableUser.email)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {assignableUser.email}
                              {assignableUser.role
                                ? ` · ${formatLeadAssigneeRoleLabel(assignableUser.role)}`
                                : ''}
                            </span>
                          </span>
                          <Check className={cn('mt-0.5 h-3.5 w-3.5 text-primary', checked ? 'opacity-100' : 'opacity-0')} />
                        </label>
                      )
                    })
                  )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Textarea
              id="bulk-reassign-bds-summary"
              value={selectedBdUsers
                .map(
                  (user, index) =>
                    `${index + 1}. ${formatLeadAssigneeName(user.name, user.email)}`
                )
                .join('\n')}
              readOnly
              rows={Math.max(3, Math.min(6, selectedBdUsers.length || 3))}
              className="resize-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
              <Checkbox
                id="bulk-reassign-remove-remarks"
                checked={removePreviousRemarks}
                onCheckedChange={(checked) => setRemovePreviousRemarks(checked === true)}
                className="border-slate-400 bg-white data-[state=checked]:border-primary dark:border-slate-500 dark:bg-slate-950"
              />
              <Label htmlFor="bulk-reassign-remove-remarks" className="cursor-pointer font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                Remove previous remarks
              </Label>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
              <Checkbox
                id="bulk-reassign-remove-followup-date"
                checked={removePreviousFollowUpDate}
                onCheckedChange={(checked) => setRemovePreviousFollowUpDate(checked === true)}
                className="border-slate-400 bg-white data-[state=checked]:border-primary dark:border-slate-500 dark:bg-slate-950"
              />
              <Label htmlFor="bulk-reassign-remove-followup-date" className="cursor-pointer font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                Remove previous follow up date
              </Label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-reassign-lead-status">Lead status</Label>
                <Select
                  value={leadStatus || '__none__'}
                  onValueChange={(value) =>
                    handleLeadStatusChange(value === '__none__' ? '' : value)
                  }
                >
                  <SelectTrigger id="bulk-reassign-lead-status">
                    <SelectValue placeholder="Leave unchanged" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Leave unchanged</SelectItem>
                    {CRM_LEAD_STATUS_OPTIONS.map((statusOption) => (
                      <SelectItem key={statusOption} value={statusOption}>
                        {statusOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showOptionalWorkflowFields ? (
                <div className="space-y-2">
                  <Label htmlFor="bulk-reassign-mode-of-payment">
                    Mode of Payment
                    <span className="text-xs font-normal text-muted-foreground"> (optional)</span>
                  </Label>
                  <Select
                    value={modeOfPayment || '__none__'}
                    onValueChange={(value) =>
                      setModeOfPayment(value === '__none__' ? '' : value)
                    }
                  >
                    <SelectTrigger id="bulk-reassign-mode-of-payment">
                      <SelectValue placeholder="Select mode of payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No mode selected</SelectItem>
                      {CRM_MODE_OF_PAYMENT_OPTIONS.map((modeOption) => (
                        <SelectItem key={modeOption} value={modeOption}>
                          {modeOption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {showOptionalWorkflowFields ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bulk-reassign-follow-up-date">
                    Follow-up date
                    <span className="text-xs font-normal text-muted-foreground"> (optional)</span>
                  </Label>
                  <Input
                    id="bulk-reassign-follow-up-date"
                    type="date"
                    value={followUpDate}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                    className="h-10 w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bulk-reassign-follow-up-time">
                    Follow-up time <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="bulk-reassign-follow-up-time"
                    type="time"
                    value={followUpTime}
                    onChange={(event) => setFollowUpTime(event.target.value)}
                    disabled={!followUpDate}
                    className="h-10 w-full"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-reassign-sub-status">Sub status</Label>
              <Input
                id="bulk-reassign-sub-status"
                value={subStatus}
                onChange={(event) => setSubStatus(event.target.value.slice(0, 25))}
                placeholder="Leave unchanged"
                maxLength={25}
              />
              <p className="text-xs text-muted-foreground">{subStatus.length}/25 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-reassign-duration">Pause duration (seconds)</Label>
              <Input
                id="bulk-reassign-duration"
                type="number"
                min={0}
                value={pauseSeconds}
                onChange={(event) => setPauseSeconds(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              selectedBdUserIds.length === 0 ||
              selectedLeadIds.length === 0
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Queueing...
              </>
            ) : (
              'Queue reassignment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
