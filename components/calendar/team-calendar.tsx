'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import type { EventInput, EventClickArg, DatesSetArg } from '@fullcalendar/core'
import type {
  CalendarAttendanceDay,
  CalendarMeet,
  CalendarStatus,
  CaseEvent,
} from '@/hooks/use-calendar'
import { cn } from '@/lib/utils'

export type CalendarView = 'month' | 'week' | 'day'

// CSS category keys — actual colors (incl. dark-mode variants) are defined
// once in the <style jsx global> block below via `.cal-ev-*` classes, so
// event coloring stays theme-aware instead of being baked in as fixed hex.
const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: 'cal-ev-available',
  ONLINE_ONLY: 'cal-ev-online',
  UNAVAILABLE: 'cal-ev-unavailable',
  CUSTOM: 'cal-ev-custom',
}

const MODULE_CLASS: Record<string, string> = {
  INTERVIEW: 'cal-ev-interview',
  MD_APPOINTMENT: 'cal-ev-md-appt',
  GENERAL: 'cal-ev-general',
}

// One CSS class per IPD/OPD × Done/Scheduled/Postponed/Cancelled combination
const CASE_EVENT_CLASS: Record<string, string> = {
  'IPD-DONE': 'cal-ev-ipd-done',
  'IPD-SCHEDULED': 'cal-ev-ipd-scheduled',
  'IPD-POSTPONED': 'cal-ev-ipd-postponed',
  'IPD-CANCELLED': 'cal-ev-ipd-cancelled',
  'OPD-DONE': 'cal-ev-opd-done',
  'OPD-SCHEDULED': 'cal-ev-opd-scheduled',
  'OPD-POSTPONED': 'cal-ev-opd-postponed',
  'OPD-CANCELLED': 'cal-ev-opd-cancelled',
}

const STATUS_LABEL: Record<string, string> = {
  DONE: 'Done',
  SCHEDULED: 'Scheduled',
  POSTPONED: 'Postponed',
  CANCELLED: 'Cancelled',
}

interface CaseTooltipData {
  patientName: string
  type: string
  status: string
  treatment: string | null
  hospital: string | null
  doctor: string | null
  circle: string | null
  bdName: string | null
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
  /** IPD/OPD case events to plot on the calendar */
  caseEvents?: CaseEvent[]
  focusedDate: Date
  onEventClick: (event: { type: 'meet' | 'status'; id: string }) => void
  onDateClick: (date: Date) => void
  onDatesSet?: (range: { start: Date; end: Date }) => void
  /** Called when a case marker is clicked — usually to open the patient page */
  onCaseClick?: (leadId: string) => void
  className?: string
}

export function TeamCalendar({
  view,
  meets,
  statuses,
  attendance,
  caseEvents = [],
  focusedDate,
  onEventClick,
  onDateClick,
  onDatesSet,
  onCaseClick,
  className,
}: TeamCalendarProps) {
  const calRef = useRef<FullCalendar | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: CaseTooltipData } | null>(null)

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
      const cls = MODULE_CLASS[m.module] ?? MODULE_CLASS.GENERAL
      out.push({
        id: `meet:${m.id}`,
        title: m.title,
        start: m.scheduledAt,
        end: m.endTime ?? undefined,
        classNames: ['cal-ev', cls],
        extendedProps: { type: 'meet', module: m.module },
      })
    }

    for (const s of statuses) {
      const cls = STATUS_CLASS[s.kind] ?? STATUS_CLASS.CUSTOM
      out.push({
        id: `status:${s.id}`,
        title: statusLabel(s.kind, s.label),
        start: s.startsAt,
        end: s.endsAt,
        display: 'block',
        classNames: ['cal-ev', cls],
        extendedProps: { type: 'status', kind: s.kind },
      })
    }

    for (const evt of caseEvents) {
      const cls = CASE_EVENT_CLASS[`${evt.type}-${evt.status}`] ?? 'cal-ev-ipd-done'
      out.push({
        id: `case:${evt.id}`,
        title: `${evt.type} ${STATUS_LABEL[evt.status] ?? evt.status} · ${evt.patientName}`,
        start: evt.date.slice(0, 10),
        allDay: true,
        classNames: ['cal-ev', cls],
        extendedProps: {
          type: 'case',
          leadId: evt.leadId,
          patientName: evt.patientName,
          caseType: evt.type,
          caseStatus: evt.status,
          treatment: evt.treatment,
          hospital: evt.hospital,
          doctor: evt.doctor,
          circle: evt.circle,
          bdName: evt.bdName,
        },
      })
    }

    return out
  }, [meets, statuses, caseEvents])

  const handleClick = (arg: EventClickArg) => {
    const [type, id] = (arg.event.id || '').split(':')
    if (type === 'meet' || type === 'status') {
      onEventClick({ type, id })
      return
    }
    if (type === 'case') {
      onCaseClick?.(id)
    }
  }

  const handleDate = (arg: DateClickArg) => onDateClick(arg.date)

  const handleDatesSet = (arg: DatesSetArg) => {
    onDatesSet?.({ start: arg.start, end: arg.end })
  }

  // Custom themed tooltip for IPD events — replaces the native browser
  // `title` tooltip, which ignores dark mode and looks inconsistent across
  // browsers/OSes.
  const handleEventDidMount = (arg: {
    event: { extendedProps: Record<string, unknown> }
    el: HTMLElement
  }) => {
    const props = arg.event.extendedProps
    if (props.type !== 'case') return
    arg.el.style.cursor = 'pointer'

    const data: CaseTooltipData = {
      patientName: String(props.patientName ?? 'Patient'),
      type: String(props.caseType ?? ''),
      status: STATUS_LABEL[String(props.caseStatus)] ?? String(props.caseStatus ?? ''),
      treatment: (props.treatment as string) ?? null,
      hospital: (props.hospital as string) ?? null,
      doctor: (props.doctor as string) ?? null,
      circle: (props.circle as string) ?? null,
      bdName: (props.bdName as string) ?? null,
    }

    const showTooltip = (e: MouseEvent) => {
      const rect = arg.el.getBoundingClientRect()
      setTooltip({ x: rect.left + rect.width / 2, y: rect.top, data })
    }
    const hideTooltip = () => setTooltip(null)

    arg.el.addEventListener('mouseenter', showTooltip)
    arg.el.addEventListener('mouseleave', hideTooltip)
  }

  const handleEventWillUnmount = () => setTooltip(null)

  return (
    <div className={cn('team-calendar relative', className)}>
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
        dayMaxEventRows={3}
        nowIndicator
        selectable={false}
        events={events}
        eventClick={handleClick}
        dateClick={handleDate}
        datesSet={handleDatesSet}
        eventDidMount={handleEventDidMount}
        eventWillUnmount={handleEventWillUnmount}
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
          const statusCls =
            att.status === 'leave' ? 'tc-att-leave' : att.status === 'in' ? 'tc-att-in' : 'tc-att-out'
          pill.className = `tc-att-pill ${statusCls}`
          pill.textContent =
            att.status === 'leave' ? 'Leave' : att.status === 'in' ? 'IN' : 'OUT'
          ;(frame as HTMLElement).style.position = 'relative'
          frame.appendChild(pill)
        }}
      />

      {/* Custom themed tooltip for IPD markers (dark-mode aware, unlike the native title tooltip) */}
      {tooltip && (
        <div
          className="cal-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="cal-tooltip-title">{tooltip.data.patientName}</p>
          <div className="cal-tooltip-body">
            <p>{tooltip.data.type} · {tooltip.data.status}</p>
            {tooltip.data.treatment && <p>Treatment: {tooltip.data.treatment}</p>}
            {tooltip.data.hospital && <p>Hospital: {tooltip.data.hospital}</p>}
            {tooltip.data.doctor && <p>Doctor: {tooltip.data.doctor}</p>}
            {tooltip.data.circle && <p>Circle: {tooltip.data.circle}</p>}
            {tooltip.data.bdName && <p>BD: {tooltip.data.bdName}</p>}
          </div>
        </div>
      )}

      <style jsx global>{`
        .team-calendar .fc {
          font-family: inherit;
          font-size: 13px;
        }

        /* ── Grid lines & structure ─────────────────────────────────────── */
        .team-calendar .fc .fc-scrollgrid,
        .team-calendar .fc .fc-scrollgrid td,
        .team-calendar .fc .fc-scrollgrid th {
          border-color: rgb(var(--border));
        }
        .team-calendar .fc-theme-standard .fc-scrollgrid,
        .team-calendar .fc-theme-standard td,
        .team-calendar .fc-theme-standard th {
          border-color: rgb(var(--border));
        }

        /* ── Headers & day numbers ──────────────────────────────────────
           NOTE: this app's design tokens (--foreground, --border, --primary…)
           are stored as space-separated RGB triples (see globals.css /
           tailwind.config), consumed elsewhere as rgb(var(--x) / <alpha>).
           Wrapping them in hsl(...) — as before — misreads the RGB triple as
           HSL components, which is why text rendered as a muddy yellow/olive
           in dark mode. Always use rgb(var(--x)) here. */
        .team-calendar .fc .fc-col-header-cell {
          background-color: rgb(var(--muted)) !important;
        }
        .team-calendar .fc .fc-col-header-cell-cushion,
        .team-calendar .fc .fc-daygrid-day-number,
        .team-calendar .fc .fc-timegrid-axis-cushion,
        .team-calendar .fc .fc-timegrid-slot-label-cushion {
          color: rgb(var(--foreground)) !important;
          padding: 4px 6px;
          font-weight: 500;
          text-decoration: none;
        }
        .team-calendar .fc .fc-day-today {
          background: color-mix(in oklab, rgb(var(--primary)) 10%, transparent) !important;
        }
        .team-calendar .fc .fc-day-other .fc-daygrid-day-number {
          color: rgb(var(--muted-foreground));
          opacity: 0.6;
        }

        /* ── Day cell hover — makes clickable dates feel interactive ───── */
        .team-calendar .fc .fc-daygrid-day,
        .team-calendar .fc .fc-timegrid-col {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .team-calendar .fc .fc-daygrid-day:hover,
        .team-calendar .fc .fc-timegrid-col:hover {
          background: rgb(var(--muted) / 0.5);
        }
        .team-calendar .fc .fc-day-today:hover {
          background: color-mix(in oklab, rgb(var(--primary)) 16%, transparent) !important;
        }

        /* ── Events — base + hover ──────────────────────────────────────── */
        .team-calendar .fc .fc-event {
          border-radius: 6px;
          border-width: 0 0 0 3px;
          padding: 1px 4px;
          font-size: 11px;
          cursor: pointer;
          transition: filter 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
        }
        .team-calendar .fc .fc-event:hover {
          filter: brightness(1.08);
          box-shadow: 0 2px 8px rgb(var(--foreground) / 0.12);
          transform: translateY(-0.5px);
        }

        .team-calendar .fc .fc-event-main,
.team-calendar .fc .fc-event-title {
  color: inherit !important;
}
        .team-calendar .fc .fc-timegrid-event {
          border-radius: 6px;
        }
        .team-calendar .fc .fc-daygrid-more-link {
          font-size: 10px;
          font-weight: 600;
          color: rgb(var(--primary));
        }
        .team-calendar .fc .fc-daygrid-more-link:hover {
          text-decoration: underline;
        }

        /* ── Event category colors — light mode (default) ──────────────── */
        .team-calendar .cal-ev-available { background: #d1fae5; border-left-color: #10b981; color: #065f46; }
        .team-calendar .cal-ev-online    { background: #e0f2fe; border-left-color: #0ea5e9; color: #0c4a6e; }
        .team-calendar .cal-ev-unavailable { background: #ffe4e6; border-left-color: #f43f5e; color: #881337; }
        .team-calendar .cal-ev-custom    { background: #ede9fe; border-left-color: #8b5cf6; color: #4c1d95; }
        .team-calendar .cal-ev-interview { background: #ede9fe; border-left-color: #7c3aed; color: #4c1d95; }
        .team-calendar .cal-ev-md-appt   { background: #fef3c7; border-left-color: #d97706; color: #78350f; }
        .team-calendar .cal-ev-general   { background: #e0e7ff; border-left-color: #4f46e5; color: #312e81; }
        /* IPD — greens/teal family */
        .team-calendar .cal-ev-ipd-done      { background: #d1fae5; border-left-color: #059669; color: #065f46; font-weight: 600; }
        .team-calendar .cal-ev-ipd-scheduled  { background: #dbeafe; border-left-color: #2563eb; color: #1e3a8a; font-weight: 600; }
        .team-calendar .cal-ev-ipd-postponed  { background: #fef3c7; border-left-color: #d97706; color: #78350f; font-weight: 600; }
        .team-calendar .cal-ev-ipd-cancelled  { background: #ffe4e6; border-left-color: #e11d48; color: #881337; font-weight: 600; text-decoration: line-through; }
        /* OPD — same status hues, slightly lighter, no bold — keeps IPD visually "heavier" */
        .team-calendar .cal-ev-opd-done       { background: #ecfdf5; border-left-color: #34d399; color: #065f46; }
        .team-calendar .cal-ev-opd-scheduled  { background: #eff6ff; border-left-color: #60a5fa; color: #1e3a8a; }
        .team-calendar .cal-ev-opd-postponed  { background: #fffbeb; border-left-color: #fbbf24; color: #78350f; }
        .team-calendar .cal-ev-opd-cancelled  { background: #fff1f2; border-left-color: #fb7185; color: #881337; text-decoration: line-through; }

        /* ── Event category colors — dark mode ──────────────────────────
           Translucent backgrounds over the dark card + brighter text keep
           good contrast instead of the light-mode pastel/dark-text pairing,
           which goes muddy on a dark surface. */
        .dark .team-calendar .cal-ev-available { background: rgb(16 185 129 / 0.18); border-left-color: #34d399; color: #86efac; }
        .dark .team-calendar .cal-ev-online    { background: rgb(14 165 233 / 0.18); border-left-color: #38bdf8; color: #7dd3fc; }
        .dark .team-calendar .cal-ev-unavailable { background: rgb(244 63 94 / 0.18); border-left-color: #fb7185; color: #fda4af; }
        .dark .team-calendar .cal-ev-custom    { background: rgb(139 92 246 / 0.2); border-left-color: #a78bfa; color: #d8b4fe; }
        .dark .team-calendar .cal-ev-interview { background: rgb(124 58 237 / 0.2); border-left-color: #a78bfa; color: #d8b4fe; }
        .dark .team-calendar .cal-ev-md-appt   { background: rgb(217 119 6 / 0.2); border-left-color: #fbbf24; color: #fde68a; }
        .dark .team-calendar .cal-ev-general   { background: rgb(79 70 229 / 0.2); border-left-color: #818cf8; color: #c7d2fe; }
        .dark .team-calendar .cal-ev-ipd-done { background: rgb(5 150 105 / 0.22); border-left-color: #34d399; color: #86efac; }
        .dark .team-calendar .cal-ev-ipd-scheduled  { background: rgb(37 99 235 / 0.22); border-left-color: #60a5fa; color: #93c5fd; }
        .dark .team-calendar .cal-ev-ipd-postponed  { background: rgb(217 119 6 / 0.22); border-left-color: #fbbf24; color: #fde68a; }
        .dark .team-calendar .cal-ev-ipd-cancelled  { background: rgb(225 29 72 / 0.22); border-left-color: #fb7185; color: #fda4af; }
        .dark .team-calendar .cal-ev-opd-done       { background: rgb(52 211 153 / 0.14); border-left-color: #6ee7b7; color: #a7f3d0; }
        .dark .team-calendar .cal-ev-opd-scheduled  { background: rgb(96 165 250 / 0.14); border-left-color: #93c5fd; color: #bfdbfe; }
        .dark .team-calendar .cal-ev-opd-postponed  { background: rgb(251 191 36 / 0.14); border-left-color: #fcd34d; color: #fde68a; }
        .dark .team-calendar .cal-ev-opd-cancelled  { background: rgb(251 113 133 / 0.14); border-left-color: #fda4af; color: #fecdd3; }

        /* ── Attendance pill ─────────────────────────────────────────────── */
        .tc-att-pill {
          position: absolute;
          top: 2px;
          left: 4px;
          font-size: 9px;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 9999px;
          pointer-events: none;
          z-index: 2;
        }
        .tc-att-pill.tc-att-in      { background: #d1fae5; color: #065f46; }
        .tc-att-pill.tc-att-out     { background: #e5e7eb; color: #374151; }
        .tc-att-pill.tc-att-leave   { background: #fef3c7; color: #92400e; }
        .dark .tc-att-pill.tc-att-in    { background: rgb(16 185 129 / 0.22); color: #86efac; }
        .dark .tc-att-pill.tc-att-out   { background: rgb(var(--muted-foreground) / 0.22); color: rgb(var(--muted-foreground)); }
        .dark .tc-att-pill.tc-att-leave { background: rgb(217 119 6 / 0.22); color: #fde68a; }


        .team-calendar .fc .fc-daygrid-day-top {
  flex-direction: row;
  justify-content: flex-end;
}
        

        /* ── Custom IPD tooltip ──────────────────────────────────────────── */
        .cal-tooltip {
          position: fixed;
          transform: translate(-50%, calc(-100% - 8px));
          z-index: 50;
          min-width: 200px;
          max-width: 260px;
          background: rgb(var(--popover));
          color: rgb(var(--popover-foreground));
          border: 1px solid rgb(var(--border));
          border-radius: var(--radius);
          box-shadow: 0 8px 24px rgb(var(--foreground) / 0.16);
          padding: 10px 12px;
          pointer-events: none;
          animation: cal-tooltip-in 0.12s ease-out;
        }
        .cal-tooltip-title {
          font-size: 12.5px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .cal-tooltip-body {
          font-size: 11.5px;
          color: rgb(var(--muted-foreground));
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        @keyframes cal-tooltip-in {
          from { opacity: 0; transform: translate(-50%, calc(-100% - 2px)); }
          to { opacity: 1; transform: translate(-50%, calc(-100% - 8px)); }
        }

        @media (max-width: 640px) {
          .team-calendar .fc {
            font-size: 11px;
          }
          .team-calendar .fc .fc-daygrid-day-number {
            padding: 2px 4px;
          }

          .team-calendar .fc-event-main {
            color: inherit;
          }

          .team-calendar .fc-event {
            --fc-event-text-color: inherit;
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