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

type SelectedIncomingLead = {
  id: number
  patientName: string
  externalCampaignId: string
  source: string
  status: string
}

export function IncomingLeadsManualAssignDialog({
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
  leadOptions: SelectedIncomingLead[]
  selectedLeadIds: number[]
  onSelectedLeadIdsChange: (leadIds: number[]) => void
  selectedLeads: SelectedIncomingLead[]
  assignableUsers: AssignableUser[]
  isPending: boolean
  onSubmit: (payload: { leadIds: number[]; assigneeUserIds: string[] }) => Promise<unknown> | void
}) {
  const [selectedAssigneeUserIds, setSelectedAssigneeUserIds] = useState<string[]>([])
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [leadQuery, setLeadQuery] = useState('')
  const [bdPickerOpen, setBdPickerOpen] = useState(false)
  const [bdQuery, setBdQuery] = useState('')

  const selectedLeadSummary = useMemo(
    () =>
      selectedLeads
        .map((lead) => `${lead.patientName} · ${lead.externalCampaignId} · ${lead.source} · ${lead.status}`)
        .join(', '),
    [selectedLeads]
  )

  const filteredLeadOptions = useMemo(() => {
    const query = leadQuery.trim().toLowerCase()
    if (!query) return leadOptions

    return leadOptions.filter((lead) => {
      const label = `${lead.patientName} ${lead.externalCampaignId} ${lead.source} ${lead.status}`.toLowerCase()
      return label.includes(query)
    })
  }, [leadOptions, leadQuery])

  const selectedLeadButtonLabel = useMemo(() => {
    if (selectedLeads.length === 0) return 'Select leads'
    if (selectedLeads.length === 1) return selectedLeads[0]?.patientName || '1 lead selected'
    return `${selectedLeads.length} leads selected`
  }, [selectedLeads])

  const allDialogLeadsSelected =
    leadOptions.length > 0 && selectedLeadIds.length === leadOptions.length

  const selectedAssigneeUsers = useMemo(
    () =>
      selectedAssigneeUserIds
        .map((userId) => assignableUsers.find((user) => user.id === userId))
        .filter((user): user is AssignableUser => Boolean(user)),
    [assignableUsers, selectedAssigneeUserIds]
  )

  const filteredAssignableUsers = useMemo(() => {
    const query = bdQuery.trim().toLowerCase()
    if (!query) return assignableUsers

    return assignableUsers.filter((user) => {
      const label = `${user.name} ${user.email} ${user.role}`.toLowerCase()
      return label.includes(query)
    })
  }, [assignableUsers, bdQuery])

  const selectedBdButtonLabel = useMemo(() => {
    if (selectedAssigneeUsers.length === 0) return 'Select users'
    if (selectedAssigneeUsers.length === 1) return selectedAssigneeUsers[0]?.name || '1 user selected'
    return `${selectedAssigneeUsers.length} users selected`
  }, [selectedAssigneeUsers])

  function toggleBd(userId: string, checked: boolean) {
    if (checked) {
      setSelectedAssigneeUserIds((current) =>
        current.includes(userId) ? current : [...current, userId]
      )
      return
    }

    setSelectedAssigneeUserIds((current) => current.filter((id) => id !== userId))
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

  async function handleSubmit() {
    await onSubmit({
      leadIds: selectedLeadIds,
      assigneeUserIds: selectedAssigneeUserIds,
    })
    handleOpenChange(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedAssigneeUserIds([])
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
          <DialogTitle>Assign Incoming Leads</DialogTitle>
          <DialogDescription>
            Assign the selected incoming leads to one or more users. Selection order is used
            for round robin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="incoming-leads-manual-assign-leads">Leads</Label>
            <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="incoming-leads-manual-assign-leads"
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
                    placeholder="Search patient, campaign, source, or status"
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      onSelectedLeadIdsChange(
                        allDialogLeadsSelected ? [] : leadOptions.map((lead) => lead.id)
                      )
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
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                        No leads found
                      </p>
                    ) : (
                      filteredLeadOptions.map((lead) => {
                        const checked = selectedLeadIds.includes(lead.id)
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
                              <span className="block truncate">{lead.patientName}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {lead.externalCampaignId} · {lead.source} · {lead.status}
                              </span>
                            </span>
                            <Check
                              className={cn(
                                'mt-0.5 h-3.5 w-3.5 text-primary',
                                checked ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                          </label>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Textarea
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
            <Label htmlFor="incoming-leads-manual-assign-bds">Users</Label>
            <Popover open={bdPickerOpen} onOpenChange={setBdPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="incoming-leads-manual-assign-bds"
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
                    placeholder="Search user name or email"
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    Selection order is used for round robin
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selectedAssigneeUserIds.length} selected
                  </span>
                </div>
                <ScrollArea className="h-[260px] overscroll-contain">
                  <div className="p-1">
                    {filteredAssignableUsers.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                        No users found
                      </p>
                    ) : (
                      filteredAssignableUsers.map((assignableUser) => {
                        const checked = selectedAssigneeUserIds.includes(assignableUser.id)
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
                            <Check
                              className={cn(
                                'mt-0.5 h-3.5 w-3.5 text-primary',
                                checked ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                          </label>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Textarea
              value={selectedAssigneeUsers.map((user, index) => `${index + 1}. ${user.name}`).join('\n')}
              readOnly
              rows={Math.max(3, Math.min(6, selectedAssigneeUsers.length || 3))}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || selectedAssigneeUserIds.length === 0 || selectedLeadIds.length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign incoming leads'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
