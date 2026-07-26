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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type AssignableUser = {
  id: string
  name: string
  email: string
  role: string
}

type SelectedLead = {
  id: string
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
  selectedLeadIds: string[]
  onSelectedLeadIdsChange: (leadIds: string[]) => void
  selectedLeads: SelectedLead[]
  assignableUsers: AssignableUser[]
  isPending: boolean
  onSubmit: (payload: {
    bdUserIds: string[]
    removePreviousRemarks: boolean
    subStatus?: number
    pauseSeconds?: number
  }) => Promise<unknown> | void
}) {
  const [selectedBdUserIds, setSelectedBdUserIds] = useState<string[]>([])
  const [removePreviousRemarks, setRemovePreviousRemarks] = useState(false)
  const [subStatus, setSubStatus] = useState('')
  const [pauseSeconds, setPauseSeconds] = useState('')
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [leadQuery, setLeadQuery] = useState('')
  const [bdPickerOpen, setBdPickerOpen] = useState(false)
  const [bdQuery, setBdQuery] = useState('')
  const bdAssignableUsers = useMemo(
    () => assignableUsers.filter((user) => user.role === 'BD'),
    [assignableUsers]
  )

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
        .map((userId) => bdAssignableUsers.find((user) => user.id === userId))
        .filter((user): user is AssignableUser => Boolean(user)),
    [bdAssignableUsers, selectedBdUserIds]
  )

  const filteredAssignableUsers = useMemo(() => {
    const query = bdQuery.trim().toLowerCase()
    if (!query) return bdAssignableUsers

    return bdAssignableUsers.filter((user) => {
      const label = `${user.name} ${user.email} ${user.role}`.toLowerCase()
      return label.includes(query)
    })
  }, [bdAssignableUsers, bdQuery])

  const selectedBdButtonLabel = useMemo(() => {
    if (selectedBdUsers.length === 0) return 'Select BDs'
    if (selectedBdUsers.length === 1) return selectedBdUsers[0]?.name || '1 BD selected'
    return `${selectedBdUsers.length} BDs selected`
  }, [selectedBdUsers])

  function toggleLead(leadId: string, checked: boolean) {
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
    await onSubmit({
      bdUserIds: selectedBdUserIds,
      removePreviousRemarks,
      ...(subStatus.trim().length > 0 ? { subStatus: Number(subStatus) } : {}),
      ...(pauseSeconds.trim().length > 0 ? { pauseSeconds: Number(pauseSeconds) } : {}),
    })
    handleOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedBdUserIds([])
      setRemovePreviousRemarks(false)
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
            Reassign leads in round-robin BD order and pause after each full BD cycle.
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
            <Label htmlFor="bulk-reassign-bds">BDs</Label>
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
                    placeholder="Search BD name or email"
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
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No BDs found</p>
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
                            <span className="block truncate">{assignableUser.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {assignableUser.email}
                              {assignableUser.role ? ` · ${assignableUser.role}` : ''}
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
              value={selectedBdUsers.map((user, index) => `${index + 1}. ${user.name}`).join('\n')}
              readOnly
              rows={Math.max(3, Math.min(6, selectedBdUsers.length || 3))}
              className="resize-none"
            />
          </div>

          <div className="flex items-center gap-3 rounded-lg border px-3 py-3">
            <Checkbox
              id="bulk-reassign-remove-remarks"
              checked={removePreviousRemarks}
              onCheckedChange={(checked) => setRemovePreviousRemarks(checked === true)}
            />
            <Label htmlFor="bulk-reassign-remove-remarks" className="cursor-pointer">
              Remove previous remarks
            </Label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-reassign-sub-status">Sub status</Label>
              <Input
                id="bulk-reassign-sub-status"
                type="number"
                min={0}
                value={subStatus}
                onChange={(event) => setSubStatus(event.target.value)}
                placeholder="Optional"
              />
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
