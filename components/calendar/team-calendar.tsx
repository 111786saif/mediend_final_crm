'use client'

import { useMemo, useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import type { EventInput, EventClickArg, DatesSetArg } from '@fullcalendar/core'
import type {
  CalendarAttendanceDay,
  CalendarMeet,
  CalendarStatus,
} from '@/hooks/use-calendar'
import { cn } from '@/lib/utils'

export type CalendarView = 'month' | 'week' | 'day'

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  AVAILABLE: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  ONLINE_ONLY: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e' },
  UNAVAILABLE: { bg: '#ffe4e6', border: '#f43f5e', text: '#881337' },
  CUSTOM: { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95' },
}

const MODULE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  INTERVIEW: { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95' },
  MD_APPOINTMENT: { bg: '#fef3c7', border: '#d97706', text: '#78350f' },
  GENERAL: { bg: '#e0e7ff', border: '#4f46e5', text: '#312e81' },
}

function statusLabel(kind: string, fallback: string | null): string {
  if (fallback) return fallback
  if (kind === 'AVAILABLE') return 'Available'
  if (kind === 'ONLINE_ONLY') return 'Online only'
  if (kind === 'UNAVAILABLE') return 'Unavailable'
  return 'Status'
}

export interface TeamCalendarProps {
  view: CalendarView
  meets: CalendarMeet[]
  statuses: CalendarStatus[]
  attendance: CalendarAttendanceDay[]
  focusedDate: Date
  onEventClick: (event: { type: 'meet' | 'status'; id: string }) => void
  onDateClick: (date: Date) => void
  onDatesSet?: (range: { start: Date; end: Date }) => void
  className?: string
}

export function TeamCalendar({
  view,
  meets,
  statuses,
  attendance,
  focusedDate,
  onEventClick,
  onDateClick,
  onDatesSet,
  className,
}: TeamCalendarProps) {
  const calRef = useRef<FullCalendar | null>(null)

  const attendanceByDate = useMemo(() => {
    const map: Record<string, CalendarAttendanceDay> = {}
    for (const a of attendance) map[a.date] = a
    return map
  }, [attendance])

  useEffect(() => {
    const api = calRef.current?.getApi()
    if (!api) return
    const fcView =
      view === 'month' ? 'dayGridMonth' : view === 'week' ? 'timeGridWeek' : 'timeGridDay'
    if (api.view.type !== fcView) api.changeView(fcView)
    api.gotoDate(focusedDate)
  }, [view, focusedDate])

  const events: EventInput[] = useMemo(() => {
    const out: EventInput[] = []

    for (const m of meets) {
      const color = MODULE_COLORS[m.module] ?? MODULE_COLORS.GENERAL
      out.push({
        id: `meet:${m.id}`,
        title: m.title,
        start: m.scheduledAt,
        end: m.endTime ?? undefined,
        backgroundColor: color.bg,
        borderColor: color.border,
        textColor: color.text,
        extendedProps: { type: 'meet', module: m.module },
      })
    }

    for (const s of statuses) {
      const color = STATUS_COLORS[s.kind] ?? STATUS_COLORS.CUSTOM
      out.push({
        id: `status:${s.id}`,
        title: statusLabel(s.kind, s.label),
        start: s.startsAt,
        end: s.endsAt,
        backgroundColor: color.bg,
        borderColor: color.border,
        textColor: color.text,
        display: 'block',
        extendedProps: { type: 'status', kind: s.kind },
      })
    }

    return out
  }, [meets, statuses])

  const handleClick = (arg: EventClickArg) => {
    const [type, id] = (arg.event.id || '').split(':')
    if (type === 'meet' || type === 'status') {
      onEventClick({ type, id })
    }
  }

  const handleDate = (arg: DateClickArg) => onDateClick(arg.date)

  const handleDatesSet = (arg: DatesSetArg) => {
    onDatesSet?.({ start: arg.start, end: arg.end })
  }

  return (
    <div className={cn('team-calendar', className)}>
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={
          view === 'month' ? 'dayGridMonth' : view === 'week' ? 'timeGridWeek' : 'timeGridDay'
        }
        initialDate={focusedDate}
        headerToolbar={false}
        height="auto"
        firstDay={1}
        dayMaxEventRows={2}
        nowIndicator
        selectable={false}
        events={events}
        eventClick={handleClick}
        dateClick={handleDate}
        datesSet={handleDatesSet}
        eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        expandRows
        dayCellDidMount={(arg) => {
          const key = arg.date.toISOString().split('T')[0]
          const att = attendanceByDate[key]
          if (!att) return
          const frame = arg.el.querySelector('.fc-daygrid-day-frame, .fc-timegrid-col-frame')
          if (!frame) return
          const pill = document.createElement('span')
          pill.className = 'tc-att-pill'
          pill.textContent =
            att.status === 'leave' ? 'Leave' : att.status === 'in' ? 'IN' : 'OUT'
          pill.setAttribute(
            'style',
            `position:absolute;top:2px;right:2px;font-size:9px;font-weight:600;padding:1px 5px;border-radius:9999px;pointer-events:none;z-index:2;${
              att.status === 'leave'
                ? 'background:#fef3c7;color:#92400e;'
                : att.status === 'in'
                  ? 'background:#d1fae5;color:#065f46;'
                  : 'background:#e5e7eb;color:#374151;'
            }`
          )
          ;(frame as HTMLElement).style.position = 'relative'
          frame.appendChild(pill)
        }}
      />
      <style jsx global>{`
        .team-calendar .fc {
          font-family: inherit;
          font-size: 13px;
        }
        .team-calendar .fc .fc-scrollgrid,
        .team-calendar .fc .fc-scrollgrid td,
        .team-calendar .fc .fc-scrollgrid th {
          border-color: hsl(var(--border));
        }
        .team-calendar .fc .fc-col-header-cell-cushion,
        .team-calendar .fc .fc-daygrid-day-number {
          color: hsl(var(--foreground));
          padding: 4px 6px;
          font-weight: 500;
          text-decoration: none;
        }
        .team-calendar .fc .fc-day-today {
          background: color-mix(in oklab, hsl(var(--primary)) 8%, transparent) !important;
        }
        .team-calendar .fc .fc-event {
          border-radius: 6px;
          border-width: 0 0 0 3px;
          padding: 1px 4px;
          font-size: 11px;
          cursor: pointer;
        }
        .team-calendar .fc .fc-timegrid-event {
          border-radius: 6px;
        }
        .team-calendar .fc .fc-daygrid-more-link {
          font-size: 10px;
          font-weight: 600;
          color: hsl(var(--primary));
        }
        @media (max-width: 640px) {
          .team-calendar .fc {
            font-size: 11px;
          }
          .team-calendar .fc .fc-daygrid-day-number {
            padding: 2px 4px;
          }
          .team-calendar .fc .fc-event {
            padding: 0 3px;
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  )
}
