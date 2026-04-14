'use client'

import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Circle, Clock, Globe, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateStatus, type CalendarStatusKind } from '@/hooks/use-calendar'
import { toast } from 'sonner'
import { format, addHours, startOfDay } from 'date-fns'

const KINDS: {
  key: CalendarStatusKind
  label: string
  sub: string
  icon: React.ElementType
  dot: string
  ring: string
}[] = [
  {
    key: 'AVAILABLE',
    label: 'Available',
    sub: 'I can be reached as usual',
    icon: Check,
    dot: 'text-emerald-600',
    ring: 'ring-emerald-300 bg-emerald-50',
  },
  {
    key: 'ONLINE_ONLY',
    label: 'Online only',
    sub: 'Reach me via chat / video',
    icon: Globe,
    dot: 'text-sky-600',
    ring: 'ring-sky-300 bg-sky-50',
  },
  {
    key: 'UNAVAILABLE',
    label: 'Unavailable',
    sub: 'Do not disturb',
    icon: XCircle,
    dot: 'text-rose-600',
    ring: 'ring-rose-300 bg-rose-50',
  },
  {
    key: 'CUSTOM',
    label: 'Custom',
    sub: 'Write your own label',
    icon: Circle,
    dot: 'text-violet-600',
    ring: 'ring-violet-300 bg-violet-50',
  },
]

function toLocalInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export function SetStatusDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const create = useCreateStatus()
  const [kind, setKind] = useState<CalendarStatusKind>('UNAVAILABLE')
  const [label, setLabel] = useState('')
  const defaultStart = startOfDay(new Date())
  defaultStart.setHours(9, 0, 0, 0)
  const defaultEnd = addHours(defaultStart, 8)
  const [startsAt, setStartsAt] = useState(toLocalInput(defaultStart))
  const [endsAt, setEndsAt] = useState(toLocalInput(defaultEnd))
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setKind('UNAVAILABLE')
    setLabel('')
    setStartsAt(toLocalInput(defaultStart))
    setEndsAt(toLocalInput(defaultEnd))
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    const s = new Date(startsAt)
    const e = new Date(endsAt)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      setError('Pick valid start and end times')
      return
    }
    if (e <= s) {
      setError('End must be after start')
      return
    }
    try {
      await create.mutateAsync({
        kind,
        label: label.trim() || null,
        startsAt: s.toISOString(),
        endsAt: e.toISOString(),
      })
      toast.success('Status saved')
      reset()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save status'
      setError(msg)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[92vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="text-base">Set my status</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto p-3 space-y-4">
          <div className="space-y-2">
            {KINDS.map((k) => {
              const Icon = k.icon
              const active = kind === k.key
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  className={cn(
                    'flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left touch-manipulation active:scale-[0.99] transition-all border',
                    active
                      ? `ring-2 ${k.ring} border-transparent`
                      : 'border-border bg-card hover:bg-muted/40'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted',
                      active && 'bg-white'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', k.dot)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{k.label}</p>
                    <p className="text-xs text-muted-foreground">{k.sub}</p>
                  </div>
                  {active && <Check className={cn('h-5 w-5 shrink-0', k.dot)} />}
                </button>
              )
            })}
          </div>

          {kind === 'CUSTOM' && (
            <div className="space-y-1.5">
              <Label htmlFor="status-label">Label</Label>
              <Input
                id="status-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="E.g. Out for field visit"
                className="rounded-xl"
                maxLength={120}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="starts-at" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Starts
              </Label>
              <Input
                id="starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ends-at" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Ends
              </Label>
              <Input
                id="ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-medium">{error}</p>
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={create.isPending}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {create.isPending ? 'Saving…' : 'Save status'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
