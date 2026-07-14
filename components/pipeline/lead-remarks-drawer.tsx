'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type LeadRemarkHistoryItem = {
  id: string
  content: string
  createdAt: string
  createdBy: {
    id: string
    name: string | null
  }
}

type LeadRemarksResponse = {
  lead: {
    id: string
    leadRef: string
    patientName: string
  }
  canEditRemarks: boolean
  canAddRemarks: boolean
  canRemoveRemarks: boolean
  latestRemark: LeadRemarkHistoryItem | null
  remarks: LeadRemarkHistoryItem[]
}

export function LeadRemarksDrawer({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [remarksDraft, setRemarksDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingRemarkId, setDeletingRemarkId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<LeadRemarksResponse, Error>({
    queryKey: ['lead-remarks', leadId],
    queryFn: () => apiGet<LeadRemarksResponse>(`/api/leads/${leadId}/remarks`),
    enabled: open && !!leadId,
    retry: false,
  })

  const canAddRemarks = data?.canAddRemarks ?? data?.canEditRemarks ?? false
  const canRemoveRemarks = data?.canRemoveRemarks ?? false
  const trimmedDraft = remarksDraft.trim()
  const canSave = trimmedDraft.length > 0 && trimmedDraft.length <= 4000

  async function handleSave() {
    if (!leadId || !canSave) return

    setSaving(true)
    try {
      await apiPost(`/api/leads/${leadId}/remarks`, { content: trimmedDraft })
      toast.success('Remark added')
      setRemarksDraft('')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-remarks', leadId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add remark')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRemark(remarkId: string) {
    if (!leadId || !canRemoveRemarks) return
    if (!window.confirm('Remove this remark from the lead history?')) return

    setDeletingRemarkId(remarkId)
    try {
      await apiDelete(`/api/leads/${leadId}/remarks/${remarkId}`)
      toast.success('Remark removed')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-remarks', leadId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove remark')
    } finally {
      setDeletingRemarkId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 flex flex-col">
        <SheetHeader className="border-b">
          <SheetTitle>{data?.lead ? data.lead.patientName : 'Lead remarks'}</SheetTitle>
          <SheetDescription>
            {data?.lead
              ? `${data.lead.leadRef} · Add a new remark and review the full history in one drawer.`
              : 'Loading remarks drawer...'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden px-4 py-4">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
              Loading remarks drawer...
            </div>
          ) : error || !data ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {error?.message ?? 'We could not load remarks for this lead right now.'}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead-remarks-editor">Add remark</Label>
                <Textarea
                  id="lead-remarks-editor"
                  value={remarksDraft}
                  onChange={(event) => setRemarksDraft(event.target.value)}
                  disabled={!canAddRemarks || saving}
                  placeholder="Add a remark for this lead"
                  rows={5}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {canAddRemarks
                      ? 'Each save adds a new remark entry to the lead history.'
                      : 'Your role or current CRM settings cannot add remarks for this lead.'}
                  </span>
                  <span>{remarksDraft.length}/4000</span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>Remarks history</Label>
                  <span className="text-xs text-muted-foreground">
                    {data.remarks.length} {data.remarks.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <ScrollArea className="h-[320px] rounded-xl border bg-muted/20 p-3">
                  {data.remarks.length === 0 ? (
                    <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
                      No remarks yet
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {data.remarks.map((remark) => (
                        <li key={remark.id} className="rounded-lg border bg-background p-3 shadow-sm">
                          {canRemoveRemarks ? (
                            <div className="mb-2 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deletingRemarkId === remark.id}
                                onClick={() => handleDeleteRemark(remark.id)}
                              >
                                {deletingRemarkId === remark.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap break-words text-sm">{remark.content}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {remark.createdBy?.name ?? 'Unknown user'} ·{' '}
                            {format(new Date(remark.createdAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading || !data || !canAddRemarks || !canSave}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Add remark'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
