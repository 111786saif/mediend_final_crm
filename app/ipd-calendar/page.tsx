'use client'

import { useMemo, useState } from 'react'
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Plus } from 'lucide-react'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useLeads } from '@/hooks/use-leads'
import {
  useCalendarEvents,
  type CalendarMeet,
} from '@/hooks/use-calendar'

import { IpdStatStrip } from '@/components/calendar/ipd-stat-strip'
import { PersonSwitcher } from '@/components/calendar/person-switcher'
import { BdFilter } from '@/components/calendar/bd-filter'
import { ViewSwitcher } from '@/components/calendar/view-switcher'
import { TeamCalendar, type CalendarView } from '@/components/calendar/team-calendar'
import { DayAgendaDrawer } from '@/components/calendar/day-agenda-drawer'
import { SetStatusDrawer } from '@/components/calendar/set-status-drawer'
import { StatusListDrawer } from '@/components/calendar/status-list-drawer'
import {
  MeetDetailsDrawer,
  type MeetDetailsMeet,
} from '@/components/meets/meet-details-drawer'

const IPD_STAGES = 'IPD_DONE,CASH_IPD_DONE,DISCHARGED,CASH_DISCHARGED'
const ALLOWED_ROLES = [
  'BD',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
]
// Roles that manage a team of BDs and get the multi-BD filter instead of
// (or in addition to) the single-person calendar switcher.
const TEAM_SCOPE_ROLES = ['TEAM_LEAD', 'ASSISTANT_CATEGORY_MANAGER', 'CATEGORY_MANAGER', 'SALES_HEAD']

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

export default function IpdCalendarPage() {
  const { user } = useAuth()
  const [targetUserId, setTargetUserId] = useState<string | undefined>(undefined)
  const effectiveTarget = targetUserId ?? user?.id ?? ''
  const isViewingSelf = !targetUserId || targetUserId === user?.id

  const isTeamScopeRole = !!user && TEAM_SCOPE_ROLES.includes(user.role)
  // Empty = show the whole team's IPDs (default). Non-empty = narrowed to picked BDs.
  const [selectedBdIds, setSelectedBdIds] = useState<string[]>([])

  const [view, setView] = useState<CalendarView>('month')
  const [focusedDate, setFocusedDate] = useState<Date>(() => new Date())

  const [agendaDate, setAgendaDate] = useState<Date | null>(null)
  const [agendaOpen, setAgendaOpen] = useState(false)
  const [selectedMeet, setSelectedMeet] = useState<CalendarMeet | null>(null)
  const [meetOpen, setMeetOpen] = useState(false)
  const [statusCreateOpen, setStatusCreateOpen] = useState(false)
  const [statusListOpen, setStatusListOpen] = useState(false)

  const range = useMemo(() => rangeForView(view, focusedDate), [view, focusedDate])
  const thisMonthRange = useMemo(() => {
    const now = new Date()
    return { start: startOfMonth(now), end: endOfMonth(now) }
  }, [])

  const { data, isLoading } = useCalendarEvents({
    targetUserId: effectiveTarget,
    from: range.start.toISOString(),
    to: range.end.toISOString(),
    enabled: !!effectiveTarget,
  })

  // Team-scope roles (TL/ACM/CM/Sales Head) see their whole team's IPDs by
  // default — omitting bdId lets the API fall back to the full org-chart
  // scope (self + all recursive subordinates). Picking specific BDs in the
  // filter narrows it down. BD role keeps the existing single-target behavior.
  const ipdBdIdParam = isTeamScopeRole
    ? (selectedBdIds.length > 0 ? selectedBdIds.join(',') : undefined)
    : effectiveTarget

  // IPDs in the currently visible range — plotted on the calendar
  const { leads: ipdLeads, isLoading: ipdLoading } = useLeads(
    {
      view: 'pipeline',
      bdId: ipdBdIdParam,
      caseStage: IPD_STAGES,
      dateField: 'surgery',
      startDate: format(range.start, 'yyyy-MM-dd'),
      endDate: format(range.end, 'yyyy-MM-dd'),
    },
    { enabled: isTeamScopeRole || !!effectiveTarget }
  )

  // IPDs for the actual current calendar month — independent of whatever
  // month/week/day the user has navigated to, for the "this month" stat
  const { leads: ipdThisMonthLeads, isLoading: thisMonthLoading } = useLeads(
    {
      view: 'pipeline',
      bdId: ipdBdIdParam,
      caseStage: IPD_STAGES,
      dateField: 'surgery',
      startDate: format(thisMonthRange.start, 'yyyy-MM-dd'),
      endDate: format(thisMonthRange.end, 'yyyy-MM-dd'),
    },
    { enabled: isTeamScopeRole || !!effectiveTarget }
  )

  const meets = data?.meets ?? []
  const statuses = data?.statuses ?? []
  const attendance = data?.attendance ?? []

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

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">You don&apos;t have access to the IPD calendar</div>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-3 w-full min-w-0 relative pb-24">
        <IpdStatStrip
          totalIpdInRange={ipdLeads?.length ?? 0}
          ipdThisMonth={ipdThisMonthLeads?.length ?? 0}
          isLoading={ipdLoading || thisMonthLoading}
        />

        {user && (
          <PersonSwitcher
            currentUserId={user.id}
            targetUserId={effectiveTarget}
            onChange={(id) => setTargetUserId(id === user.id ? undefined : id)}
          />
        )}

        {isTeamScopeRole && (
          <BdFilter selectedIds={selectedBdIds} onChange={setSelectedBdIds} />
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
            ipds={ipdLeads}
            focusedDate={focusedDate}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onIpdClick={(leadId) => window.open(`/patient/${leadId}`, '_blank', 'noopener,noreferrer')}
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