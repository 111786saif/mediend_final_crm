'use client'

import { format, isSameDay } from 'date-fns'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Video, MapPin, Clock, Circle } from 'lucide-react'
import type {
  CalendarAttendanceDay,
  CalendarMeet,
  CalendarStatus,
} from '@/hooks/use-calendar'

const STATUS_KIND_STYLES: Record<string, { dot: string; label: string; chip: string }> = {
  AVAILABLE: { dot: 'bg-emerald-500', label: 'Available', chip: 'bg-emerald-100 text-emerald-800' },
  ONLINE_ONLY: { dot: 'bg-sky-500', label: 'Online only', chip: 'bg-sky-100 text-sky-800' },
  UNAVAILABLE: { dot: 'bg-rose-500', label: 'Unavailable', chip: 'bg-rose-100 text-rose-800' },
  CUSTOM: { dot: 'bg-violet-500', label: 'Custom', chip: 'bg-violet-100 text-violet-800' },
}

const MODULE_TONE: Record<string, string> = {
  INTERVIEW: 'bg-violet-600 text-white',
  MD_APPOINTMENT: 'bg-amber-600 text-white',
  GENERAL: 'bg-indigo-600 text-white',
}

export function DayAgendaDrawer({
  open,
  onOpenChange,
  date,
  meets,
  statuses,
  attendance,
  onMeetClick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  date: Date | null
  meets: CalendarMeet[]
  statuses: CalendarStatus[]
  attendance: CalendarAttendanceDay[]
  onMeetClick: (meet: CalendarMeet) => void
}) {
  if (!date) return null

  const dayMeets = meets
    .filter((m) => isSameDay(new Date(m.scheduledAt), date))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))

  const dayStatuses = statuses.filter((s) => {
    const start = new Date(s.startsAt)
    const end = new Date(s.endsAt)
    return date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && date <= end
  })

  const dayAttendance = attendance.find((a) => {
    const d = new Date(a.date + 'T00:00:00')
    return isSameDay(d, date)
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2 text-base">
            <span>{format(date, 'EEEE, MMM d')}</span>
            {dayAttendance && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  dayAttendance.status === 'leave' && 'bg-amber-100 text-amber-800',
                  dayAttendance.status === 'in' && 'bg-green-100 text-green-800',
                  dayAttendance.status === 'out' && 'bg-muted text-muted-foreground'
                )}
              >
                {dayAttendance.status === 'leave'
                  ? 'Leave'
                  : dayAttendance.status === 'in'
                    ? 'IN'
                    : 'OUT'}
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-3 pt-3 pb-4 space-y-4">
          {dayStatuses.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Status
              </h3>
              <div className="space-y-1.5">
                {dayStatuses.map((s) => {
                  const style = STATUS_KIND_STYLES[s.kind] ?? STATUS_KIND_STYLES.CUSTOM
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
                    >
                      <Circle className={cn('h-3 w-3 fill-current', style.dot.replace('bg-', 'text-'))} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">
                          {s.label || style.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(new Date(s.startsAt), 'MMM d, h:mm a')} →{' '}
                          {format(new Date(s.endsAt), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Meetings
            </h3>
            {dayMeets.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing scheduled.
              </div>
            ) : (
              <ul className="space-y-2">
                {dayMeets.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onMeetClick(m)}
                      className="block w-full text-left rounded-xl border border-border bg-card p-3 transition-colors active:bg-muted/40 touch-manipulation"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Badge
                          className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide border-0',
                            MODULE_TONE[m.module] ?? MODULE_TONE.GENERAL
                          )}
                        >
                          {m.module === 'INTERVIEW'
                            ? 'Interview'
                            : m.module === 'MD_APPOINTMENT'
                              ? 'MD'
                              : 'Meet'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            m.type === 'VIRTUAL'
                              ? 'border-indigo-400 text-indigo-700'
                              : 'border-amber-400 text-amber-800'
                          )}
                        >
                          {m.type === 'VIRTUAL' ? (
                            <span className="flex items-center gap-0.5">
                              <Video className="h-3 w-3" /> Virtual
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> Offline
                            </span>
                          )}
                        </Badge>
                      </div>
                      <p className="font-semibold text-sm leading-snug line-clamp-2">
                        {m.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(m.scheduledAt), 'h:mm a')}
                        {m.endTime && <> – {format(new Date(m.endTime), 'h:mm a')}</>}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
