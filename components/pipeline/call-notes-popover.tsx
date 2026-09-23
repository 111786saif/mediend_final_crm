'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiGet, apiPost } from '@/lib/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, MessageSquareText } from 'lucide-react'
import { useState } from 'react'

export interface CallNoteRow {
  id: string
  content: string
  createdAt: string
  createdBy: { id: string; name: string }
}

export function CallNotesPopover({
  leadId,
  onRowClickStop,
  noteCount,
}: {
  leadId: number
  onRowClickStop?: boolean
  /** From batch /api/call-notes/counts — avoids N+1 */
  noteCount?: number
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['call-notes', leadId],
    queryFn: () => apiGet<CallNoteRow[]>(`/api/call-notes?leadId=${encodeURIComponent(leadId)}`),
    enabled: open,
  })

  const addMutation = useMutation({
    mutationFn: (content: string) => apiPost<CallNoteRow>('/api/call-notes', { leadId, content }),
    onSuccess: () => {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['call-notes', leadId] })
      queryClient.invalidateQueries({ queryKey: ['call-note-counts'] })
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 shrink-0"
          onClick={(e) => {
            if (onRowClickStop) e.stopPropagation()
          }}
          aria-label="Call notes"
        >
          <MessageSquareText className="h-4 w-4" />
          {(noteCount ?? 0) > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {(noteCount ?? 0) > 9 ? '9+' : noteCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Call notes</p>
          <p className="text-xs text-muted-foreground">Log each call; newest first</p>
        </div>
        <ScrollArea className="h-[200px] p-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No notes yet</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border bg-muted/40 p-2 text-sm">
                  <p className="whitespace-pre-wrap break-words">{n.content}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {n.createdBy?.name ?? '—'} · {format(new Date(n.createdAt), 'MMM d, h:mm a')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="flex gap-2 border-t p-2">
          <Input
            placeholder="Add a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const t = text.trim()
                if (t && !addMutation.isPending) addMutation.mutate(t)
              }
            }}
            className="text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={!text.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate(text.trim())}
          >
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
