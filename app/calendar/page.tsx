'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ArrowLeft, CalendarDays, Plus, Settings } from 'lucide-react'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  useCalendarEvents,
  type CalendarMeet,
} from '@/hooks/use-calendar'

import { CalendarStatStrip } from '@/components/calendar/calendar-stat-strip'
import { PersonSwitcher } from '@/components/calendar/person-switcher'
import { ViewSwitcher } from '@/components/calendar/view-switcher'
import { TeamCalendar, type CalendarView } from '@/components/calendar/team-calendar'
import { DayAgendaDrawer } from '@/components/calendar/day-agenda-drawer'
import { SetStatusDrawer } from '@/components/calendar/set-status-drawer'
import { StatusListDrawer } from '@/components/calendar/status-list-drawer'
import {
  MeetDetailsDrawer,
  type MeetDetailsMeet,
} from '@/components/meets/meet-details-drawer'

function rangeForView(view: CalendarView, focus: Date): { start: Date; end: Date } {
  if (view === 'month') {
    return {
      start: startOfWeek(startOfMonth(focus), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(focus), { weekStartsOn: 1 }),
    }
  }
  if (view === 'week') {
    return {
      start: startOfWeek(focus, { weekStartsOn: 1 }),
      end: endOfWeek(focus, { weekStartsOn: 1 }),
    }
  }
  const start = new Date(focus)
  start.setHours(0, 0, 0, 0)
  const end = new Date(focus)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined)
  const effectiveTarget = targetUserId ?? user?.id ?? ''
  const isViewingSelf = !targetUserId || targetUserId === user?.id

  const [view, setView] = useState<CalendarView>('month')
  const [focusedDate, setFocusedDate] = useState<Date>(() => new Date())

  const [agendaDate, setAgendaDate] = useState<Date | null>(null)
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [selectedMeet, setSelectedMeet] = useState<CalendarMeet | null>(null)
  const [meetOpen, setMeetOpen] = useState(false)
  const [statusCreateOpen, setStatusCreateOpen] = useState(false)
  const [statusListOpen, setStatusListOpen] = useState(false)

  const range = useMemo(() => rangeForView(view, focusedDate), [view, focusedDate])

  const { data, isLoading } = useCalendarEvents({
    targetUserId: effectiveTarget,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    enabled: !!effectiveTarget,
  })

  const meets = data?.meets ?? []
  const statuses = data?.statuses ?? []
  const attendance = data?.attendance ?? []
  const counts = data?.counts ?? { upcomingMeets: 0, upcomingInterviews: 0 }

  const handleEventClick = (evt: { type: 'meet' | 'status'; id: string }) => {
    if (evt.type === 'meet') {
      const m = meets.find((mm) => mm.id === evt.id)
      if (m) {
        setSelectedMeet(m)
        setMeetOpen(true)
      }
      return
    }
    if (evt.type === 'status' && isViewingSelf) {
      setStatusListOpen(true)
    }
  }

  const handleDateClick = (date: Date) => {
    setAgendaDate(date)
    setAgendaOpen(true)
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-3 w-full min-w-0 relative pb-24">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            asChild
          >
            <Link href="/home" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-indigo-600" />
              Calendar
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => setStatusListOpen(true)}
            aria-label="Manage my statuses"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <CalendarStatStrip
          upcomingMeets={counts.upcomingMeets}
          upcomingInterviews={counts.upcomingInterviews}
          isLoading={isLoading}
        />

        {user && (
          <PersonSwitcher
            currentUserId={user.id}
            targetUserId={effectiveTarget}
            onChange={(id) => setTargetUserId(id === user.id ? undefined : id)}
          />
        )}

        <ViewSwitcher
          view={view}
          onViewChange={setView}
          focusedDate={focusedDate}
          onFocusedDateChange={setFocusedDate}
        />

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <TeamCalendar
            view={view}
            meets={meets}
            statuses={statuses}
            attendance={attendance}
            focusedDate={focusedDate}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        </div>

        {isLoading && (
          <div className="text-center text-xs text-muted-foreground">Loading…</div>
        )}

        <Button
          type="button"
          size="icon"
          className="fixed z-40 h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-6"
          aria-label="Set my status"
          onClick={() => setStatusCreateOpen(true)}
        >
          <Plus className="h-7 w-7" />
        </Button>

        <DayAgendaDrawer
          open={agendaOpen}
          onOpenChange={setAgendaOpen}
          date={agendaDate}
          meets={meets}
          statuses={statuses}
          attendance={attendance}
          onMeetClick={(m) => {
            setSelectedMeet(m)
            setMeetOpen(true)
          }}
        />

        <MeetDetailsDrawer
          open={meetOpen}
          onOpenChange={setMeetOpen}
          meet={selectedMeet as unknown as MeetDetailsMeet | null}
          currentUserId={user?.id}
        />

        <SetStatusDrawer
          open={statusCreateOpen}
          onOpenChange={setStatusCreateOpen}
        />
        <StatusListDrawer
          open={statusListOpen}
          onOpenChange={setStatusListOpen}
        />
      </div>
    </AuthenticatedLayout>
  )
}
