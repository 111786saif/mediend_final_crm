'use client'

import { useMemo } from 'react'
import { eachDayOfInterval, format, getDay } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MIN_FULL_DAY_HOURS } from '@/lib/hrms/attendance-utils'

export type AttendanceStatusType =
  | 'on-time'
  | 'grace-1'
  | 'grace-2'
  | 'late-penalty'
  | 'half-day'
  | 'present'
  | 'late'
  | 'absent'
  | 'holiday'
  | 'official-holiday'
  | 'normalized'
  | 'pending-normalization'
  | 'paid-leave'
  | 'unpaid-leave'

export interface AttendanceDay {
  date: Date
  inTime: Date | null
  outTime: Date | null
  /** Present when API sends grouped attendance (same as server `calculateWorkHours`). */
  workHours?: number | null
  isLate: boolean
  status?: AttendanceStatusType
  penalty?: number
  isHalfDay?: boolean
  isNormalized?: boolean
  isPendingNormalization?: boolean
}

export interface LeaveDay {
  date: string
  isUnpaid: boolean
}

interface AttendanceHeatmapProps {
  attendance: AttendanceDay[]
  fromDate: string
  toDate: string
  leaveDays?: LeaveDay[]
  holidayDays?: { date: string; name: string }[]
}

function formatTime(date: Date | string | null) {
  if (date == null) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (typeof d.getTime !== 'function' || isNaN(d.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null
  const d = typeof value === 'string' ? new Date(value) : value
  return typeof d.getTime === 'function' && !isNaN(d.getTime()) ? d : null
}

/** Show "-" when only punch-in exists (no punch-out or entry time === exit time). */
function getExitTimeDisplay(inTime: Date | string | null, outTime: Date | string | null): string {
  const out = toDate(outTime)
  if (!out) return '-'
  const inVal = toDate(inTime)
  if (inVal && out.getTime() === inVal.getTime()) return '-'
  return formatTime(outTime)
}

function getWorkHoursFromRecord(record: AttendanceDay): number | null {
  if (record.workHours != null && typeof record.workHours === 'number' && !Number.isNaN(record.workHours)) {
    return record.workHours
  }
  const a = toDate(record.inTime)
  const b = toDate(record.outTime)
  if (!a || !b) return null
  const diffMs = b.getTime() - a.getTime()
  if (diffMs <= 0) return null
  return diffMs / (1000 * 60 * 60)
}

/**
 * Half-day (pink) when server says so, or when 9h are not completed (matches payroll rule).
 * Used so the grid stays correct even if `status` / `isHalfDay` are missing on the client.
 */
export function shouldShowHalfDayPink(record: AttendanceDay): boolean {
  if (record.status === 'half-day') return true
  if (record.isHalfDay === true) return true
  const wh = getWorkHoursFromRecord(record)
  if (wh === null) {
    return record.inTime != null
  }
  return wh < MIN_FULL_DAY_HOURS
}

function getStatusConfig(
  attendanceRecord: AttendanceDay | undefined,
  leaveInfo: LeaveDay | undefined,
  isSunday: boolean,
  dateKey: string,
  officialHoliday?: { name: string }
): { status: AttendanceStatusType; bgColor: string; textColor: string; tooltipText: string; pendingNormalization?: boolean; baseBgColor?: string } {
  if (attendanceRecord) {
    if (attendanceRecord.isNormalized) {
      return {
        status: 'normalized',
        bgColor: 'bg-blue-500',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Normalized (Full day)\nEntry: ${formatTime(attendanceRecord.inTime)}\nExit: ${getExitTimeDisplay(attendanceRecord.inTime, attendanceRecord.outTime)}`,
      }
    }
    if (attendanceRecord.isPendingNormalization) {
      const base = getStatusConfig(
        { ...attendanceRecord, isPendingNormalization: false },
        undefined,
        false,
        dateKey,
        undefined
      )
      return {
        status: 'pending-normalization',
        bgColor: base.bgColor,
        textColor: base.textColor,
        tooltipText: `${dateKey} - Applied for normalization (pending HR approval)\nEntry: ${formatTime(attendanceRecord.inTime)}\nExit: ${getExitTimeDisplay(attendanceRecord.inTime, attendanceRecord.outTime)}`,
        pendingNormalization: true,
        baseBgColor: base.bgColor,
      }
    }
    const entryExit = `Entry: ${formatTime(attendanceRecord.inTime)}\nExit: ${getExitTimeDisplay(attendanceRecord.inTime, attendanceRecord.outTime)}`

    if (shouldShowHalfDayPink(attendanceRecord)) {
      return {
        status: 'half-day',
        bgColor: 'bg-pink-400',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Half day\n${entryExit}`,
      }
    }

    const status = attendanceRecord.status
    if (status === 'on-time') {
      return {
        status: 'on-time',
        bgColor: 'bg-green-600',
        textColor: 'text-white',
        tooltipText: `${dateKey} - On time\n${entryExit}`,
      }
    }
    if (status === 'grace-1') {
      return {
        status: 'grace-1',
        bgColor: 'bg-green-600',
        textColor: 'text-white',
        tooltipText: `${dateKey} - On time\n${entryExit}`,
      }
    }
    if (status === 'grace-2') {
      return {
        status: 'grace-2',
        bgColor: 'bg-green-400',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Grace\n${entryExit}`,
      }
    }
    if (status === 'late-penalty') {
      return {
        status: 'late-penalty',
        bgColor: 'bg-yellow-500',
        textColor: 'text-gray-900',
        tooltipText: `${dateKey} - Late (penalty ₹${attendanceRecord.penalty ?? 0})\n${entryExit}`,
      }
    }
    if (attendanceRecord.isLate) {
      return {
        status: 'late',
        bgColor: 'bg-yellow-500',
        textColor: 'text-gray-900',
        tooltipText: `${dateKey} - Late\n${entryExit}`,
      }
    }
    return {
      status: 'present',
      bgColor: 'bg-green-600',
      textColor: 'text-white',
      tooltipText: `${dateKey} - Present\n${entryExit}`,
    }
  }

  if (leaveInfo) {
    if (leaveInfo.isUnpaid) {
      return {
        status: 'unpaid-leave',
        bgColor: 'bg-red-500',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Unpaid leave`,
      }
    }
    return {
      status: 'paid-leave',
      bgColor: 'bg-blue-400',
      textColor: 'text-white',
      tooltipText: `${dateKey} - Paid leave`,
    }
  }

  if (officialHoliday) {
    return {
      status: 'official-holiday',
      bgColor: 'bg-orange-400',
      textColor: 'text-white',
      tooltipText: `${dateKey} - ${officialHoliday.name} (Official Holiday)`,
    }
  }

  if (isSunday) {
    return {
      status: 'holiday',
      bgColor: 'bg-purple-300',
      textColor: 'text-purple-900',
      tooltipText: `${dateKey} - Sunday (Holiday)`,
    }
  }

  return {
    status: 'absent',
    bgColor: 'bg-gray-200',
    textColor: 'text-gray-500',
    tooltipText: `${dateKey} - Absent`,
  }
}

export function AttendanceHeatmap({ attendance, fromDate, toDate, leaveDays = [], holidayDays = [] }: AttendanceHeatmapProps) {
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceDay>()
    attendance.forEach((day) => {
      const dateKey = format(new Date(day.date), 'yyyy-MM-dd')
      map.set(dateKey, day)
    })
    return map
  }, [attendance])

  const leaveMap = useMemo(() => {
    const map = new Map<string, LeaveDay>()
    leaveDays.forEach((ld) => map.set(ld.date, ld))
    return map
  }, [leaveDays])

  const holidayMap = useMemo(() => {
    const map = new Map<string, string>()
    holidayDays.forEach((h) => map.set(h.date, h.name))
    return map
  }, [holidayDays])

  const allDates = useMemo(() => {
    const [startYear, startMonth, startDay] = fromDate.split('-').map(Number)
    const [endYear, endMonth, endDay] = toDate.split('-').map(Number)
    const start = new Date(startYear, startMonth - 1, startDay)
    const end = new Date(endYear, endMonth - 1, endDay)
    return eachDayOfInterval({ start, end })
  }, [fromDate, toDate])

  const heatmapCells = useMemo(() => {
    return allDates.map((date) => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const dayOfWeek = getDay(date)
      const isSunday = dayOfWeek === 0
      const attendanceRecord = attendanceMap.get(dateKey)
      const leaveInfo = leaveMap.get(dateKey)
      const holidayName = holidayMap.get(dateKey)
      const officialHoliday = holidayName ? { name: holidayName } : undefined
      const config = getStatusConfig(
        attendanceRecord,
        leaveInfo,
        isSunday,
        format(date, 'PPP'),
        officialHoliday
      )
      return {
        date,
        dateKey,
        ...config,
        dayAbbr: format(date, 'EEE').slice(0, 3),
        dateNum: format(date, 'd'),
        fullDate: format(date, 'PPP'),
      }
    })
  }, [allDates, attendanceMap, leaveMap, holidayMap])

  if (heatmapCells.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No dates in selected range
      </div>
    )
  }

  const MAX_ENTRIES_PER_ROW = 7
  const rows = useMemo(() => {
    const result: typeof heatmapCells[] = []
    for (let i = 0; i < heatmapCells.length; i += MAX_ENTRIES_PER_ROW) {
      result.push(heatmapCells.slice(i, i + MAX_ENTRIES_PER_ROW))
    }
    return result
  }, [heatmapCells])

  return (
    <div className="space-y-4">
      {rows.map((row, rowIndex) => (
        <div key={`heatmap-${rowIndex}`} className="overflow-x-auto -mx-6 px-6">
          <div className="inline-flex gap-1 min-w-fit">
            <TooltipProvider>
              {row.map((cell) => (
                <Tooltip key={cell.dateKey}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'w-12 h-12 rounded-md flex flex-col items-center justify-center text-xs font-medium transition-colors cursor-pointer hover:opacity-80 shrink-0 relative overflow-hidden',
                        !('pendingNormalization' in cell && cell.pendingNormalization) && cell.bgColor,
                        cell.textColor
                      )}
                    >
                      {'pendingNormalization' in cell && cell.pendingNormalization ? (
                        <>
                          <div className="absolute inset-0 flex">
                            <div className="w-1/2 bg-blue-400" />
                            <div className={cn('w-1/2', cell.baseBgColor ?? cell.bgColor)} />
                          </div>
                          <span className="relative z-10 text-[10px] opacity-90">{cell.dayAbbr}</span>
                          <span className="relative z-10 font-semibold text-sm">{cell.dateNum}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] opacity-80">{cell.dayAbbr}</span>
                          <span className="font-semibold text-sm">{cell.dateNum}</span>
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="whitespace-pre-line text-sm">{cell.tooltipText}</div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600" />
          <span>On time</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-400" />
          <span>Grace</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span>Late (penalty)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-pink-400" />
          <span>Half day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500" />
          <span>Normalized</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded flex overflow-hidden">
            <div className="w-1/2 bg-blue-400" />
            <div className="w-1/2 bg-yellow-500" />
          </div>
          <span>Applied (pending)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-400" />
          <span>Paid leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span>Unpaid leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200" />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-300" />
          <span>Sunday</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-400" />
          <span>Official Holiday</span>
        </div>
      </div>
    </div>
  )
}
