'use client'

import { format } from 'date-fns'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeleteStatus, useMyStatuses } from '@/hooks/use-calendar'
import { toast } from 'sonner'

const KIND_TONE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ONLINE_ONLY: 'bg-sky-100 text-sky-800 border-sky-200',
  UNAVAILABLE: 'bg-rose-100 text-rose-800 border-rose-200',
  CUSTOM: 'bg-violet-100 text-violet-800 border-violet-200',
}

const KIND_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  ONLINE_ONLY: 'Online only',
  UNAVAILABLE: 'Unavailable',
  CUSTOM: 'Custom',
}

export function StatusListDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: statuses = [], isLoading } = useMyStatuses()
  const remove = useDeleteStatus()

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[80vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-base">My statuses</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : statuses.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No upcoming or active statuses.
            </div>
          ) : (
            statuses.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-3',
                  KIND_TONE[s.kind] ?? KIND_TONE.CUSTOM
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {s.label || KIND_LABEL[s.kind] || 'Status'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {format(new Date(s.startsAt), 'MMM d, h:mm a')} →{' '}
                    {format(new Date(s.endsAt), 'MMM d, h:mm a')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full hover:bg-white/50"
                  onClick={async () => {
                    try {
                      await remove.mutateAsync(s.id)
                      toast.success('Status removed')
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to delete')
                    }
                  }}
                  aria-label="Delete status"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
