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
  AVAILABLE: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  ONLINE_ONLY: { bg: '#f59e0b', border: '#d97706', text: '#0f172a' },
  UNAVAILABLE: { bg: '#f43f5e', border: '#e11d48', text: '#ffffff' },
  CUSTOM: { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },
}

const MODULE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  INTERVIEW: { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },
  MD_APPOINTMENT: { bg: '#f59e0b', border: '#d97706', text: '#0f172a' },
  GENERAL: { bg: '#06b6d4', border: '#0891b2', text: '#0f172a' },
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
        
        /* 1. Remove standard grid borders and make cells collapse separate with gap spacing */
        .team-calendar .fc .fc-scrollgrid {
          border: none !important;
        }
        .team-calendar .fc-scrollgrid-sync-table,
        .team-calendar .fc-daygrid-body table,
        .team-calendar .fc .fc-timegrid-slots table,
        .team-calendar .fc .fc-timegrid-cols table {
          border-collapse: separate !important;
          border-spacing: 6px 6px !important;
        }

        /* 2. Format Header Weekday Labels (SUN, MON...) */
        .team-calendar .fc .fc-col-header-cell {
          background-color: #232b41 !important;
          border: 1px solid #2e374f !important;
          border-radius: 8px !important;
          padding: 6px 0 !important;
        }
        .team-calendar .fc .fc-col-header-cell-cushion {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b !important;
          text-decoration: none;
        }

        /* 3. Style day cells as elevated cards with #232B41 background */
        .team-calendar .fc .fc-daygrid-day {
          background-color: #232b41 !important;
          border: 1px solid #2e374f !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2) !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Hover effect to make cells appear "uplifted" */
        .team-calendar .fc .fc-daygrid-day:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2) !important;
          border-color: #3e4866 !important;
        }

        /* Reduce the height of date block cells */
        .team-calendar .fc .fc-daygrid-day-frame {
          min-height: 42px !important;
        }

        /* 4. Muted shade for other-month days */
        .team-calendar .fc .fc-day-other {
          background-color: #181d2a !important;
          opacity: 0.45;
        }

        /* 5. Day Number on the top-left */
        .team-calendar .fc .fc-daygrid-day-top {
          flex-direction: row !important;
          justify-content: flex-start !important;
          padding: 4px 6px !important;
        }
        .team-calendar .fc .fc-daygrid-day-number {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8 !important;
          text-decoration: none;
        }

        /* 6. Today/focused cell with cyan highlight */
        .team-calendar .fc .fc-day-today {
          background-color: #2a344d !important;
          border-color: #06b6d4 !important;
          box-shadow: inset 0 0 0 1.5px #06b6d4, 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
        }
        .team-calendar .fc .fc-day-today .fc-daygrid-day-number {
          color: #06b6d4 !important;
        }

        /* 7. Event Pills fully rounded and matching mockup spacing */
        .team-calendar .fc .fc-event {
          border-radius: 9999px;
          border-width: 1px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          margin: 3px 6px;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .team-calendar .fc .fc-timegrid-event {
          border-radius: 6px;
        }
        .team-calendar .fc .fc-daygrid-more-link {
          font-size: 10px;
          font-weight: 600;
          color: #06b6d4;
          margin-left: 6px;
        }

        /* 8. Timegrid (Week / Day views) slot overrides */
        .team-calendar .fc .fc-timegrid-slot,
        .team-calendar .fc .fc-timegrid-col {
          background-color: #232b41 !important;
          border-color: #2e374f !important;
        }

        @media (max-width: 640px) {
          .team-calendar .fc {
            font-size: 11px;
          }
          .team-calendar .fc .fc-daygrid-day-number {
            padding: 2px 4px;
          }
          .team-calendar .fc .fc-event {
            padding: 0 4px;
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  )
}
