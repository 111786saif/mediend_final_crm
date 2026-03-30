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
import { MIN_HALF_DAY_HOURS } from '@/lib/hrms/attendance-constants'
import {
  shouldShowHalfDayPink,
  type AttendanceDay,
  type AttendanceStatusType,
  type LeaveDay,
} from './attendance-heatmap'

function formatTime(date: Date | string | null) {
  if (!date) return 'N/A'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function getStatusConfig(
  attendanceRecord: AttendanceDay | undefined,
  leaveInfo: LeaveDay | undefined,
  isSunday: boolean,
  dateKey: string
): { status: AttendanceStatusType; bgColor: string; textColor: string; tooltipText: string; pendingNormalization?: boolean; baseBgColor?: string } {
  if (attendanceRecord) {
    if (attendanceRecord.isNormalized) {
      return {
        status: 'normalized',
        bgColor: 'bg-blue-500',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Normalized (Full day)\nEntry: ${formatTime(attendanceRecord.inTime)}\nExit: ${formatTime(attendanceRecord.outTime)}`,
      }
    }
    if (attendanceRecord.isPendingNormalization) {
      const base = getStatusConfig(
        { ...attendanceRecord, isPendingNormalization: false },
        undefined,
        false,
        dateKey
      )
      return {
        status: 'pending-normalization',
        bgColor: base.bgColor,
        textColor: base.textColor,
        tooltipText: `${dateKey} - Applied for normalization (pending HR approval)\nEntry: ${formatTime(attendanceRecord.inTime)}\nExit: ${formatTime(attendanceRecord.outTime)}`,
        pendingNormalization: true,
        baseBgColor: base.bgColor,
      }
    }
    if (leaveInfo?.isHalfDay) {
      const entryExit = `Entry: ${formatTime(attendanceRecord.inTime)}\nExit: ${formatTime(attendanceRecord.outTime)}`
      const suffix = attendanceRecord.inTime ? `\n${entryExit}` : ''
      if (leaveInfo.isUnpaid) {
        return {
          status: 'unpaid-leave-half',
          bgColor: 'bg-rose-400',
          textColor: 'text-white',
          tooltipText: `${dateKey} - Unpaid half-day leave (0.5 day)${suffix}`,
        }
      }
      return {
        status: 'paid-leave-half',
        bgColor: 'bg-cyan-500',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Paid half-day leave (0.5 day)${suffix}`,
      }
    }
    const entryExit = `Entry: ${formatTime(attendanceRecord.inTime)}\nExit: ${formatTime(attendanceRecord.outTime)}`

    if (attendanceRecord.status === 'absent') {
      return {
        status: 'absent',
        bgColor: 'bg-red-600',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Absent (under ${MIN_HALF_DAY_HOURS}h worked)\n${entryExit}`,
      }
    }

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
      return { status: 'on-time', bgColor: 'bg-green-600', textColor: 'text-white', tooltipText: `${dateKey} - On time\n${entryExit}` }
    }
    if (status === 'grace-1') {
      return { status: 'grace-1', bgColor: 'bg-green-600', textColor: 'text-white', tooltipText: `${dateKey} - On time\n${entryExit}` }
    }
    if (status === 'grace-2') {
      return { status: 'grace-2', bgColor: 'bg-green-400', textColor: 'text-white', tooltipText: `${dateKey} - Grace\n${entryExit}` }
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
      return { status: 'late', bgColor: 'bg-yellow-500', textColor: 'text-gray-900', tooltipText: `${dateKey} - Late\n${entryExit}` }
    }
    return { status: 'present', bgColor: 'bg-green-600', textColor: 'text-white', tooltipText: `${dateKey} - Present\n${entryExit}` }
  }
  if (leaveInfo) {
    if (leaveInfo.isHalfDay) {
      if (leaveInfo.isUnpaid) {
        return {
          status: 'unpaid-leave-half',
          bgColor: 'bg-rose-400',
          textColor: 'text-white',
          tooltipText: `${dateKey} - Unpaid half-day leave (0.5 day)`,
        }
      }
      return {
        status: 'paid-leave-half',
        bgColor: 'bg-cyan-500',
        textColor: 'text-white',
        tooltipText: `${dateKey} - Paid half-day leave (0.5 day)`,
      }
    }
    if (leaveInfo.isUnpaid) {
      return { status: 'unpaid-leave', bgColor: 'bg-red-500', textColor: 'text-white', tooltipText: `${dateKey} - Unpaid leave` }
    }
    return { status: 'paid-leave', bgColor: 'bg-blue-400', textColor: 'text-white', tooltipText: `${dateKey} - Paid leave` }
  }
  if (isSunday) {
    return { status: 'holiday', bgColor: 'bg-purple-300', textColor: 'text-purple-900', tooltipText: `${dateKey} - Sunday (Holiday)` }
  }
  return { status: 'absent', bgColor: 'bg-gray-200', textColor: 'text-gray-500', tooltipText: `${dateKey} - Absent` }
}

export interface SelectableAttendanceHeatmapProps {
  attendance: AttendanceDay[]
  fromDate: string
  toDate: string
  leaveDays?: LeaveDay[]
  selectedDates: Set<string>
  onSelectionChange: (dates: Set<string>) => void
  /** Date keys (yyyy-MM-dd) past the application deadline (5th of next month); these days are not selectable. */
  disabledDateKeys?: Set<string>
}

export function SelectableAttendanceHeatmap({
  attendance,
  fromDate,
  toDate,
  leaveDays = [],
  selectedDates,
  onSelectionChange,
  disabledDateKeys,
}: SelectableAttendanceHeatmapProps) {
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
      const config = getStatusConfig(
        attendanceRecord,
        leaveInfo,
        isSunday,
        format(date, 'PPP')
      )
      const isNormalized = attendanceRecord?.isNormalized
      const isPending = attendanceRecord?.isPendingNormalization
      const isPastDeadline = disabledDateKeys?.has(dateKey)
      const hasAttendance = !!attendanceRecord
      const isSelectable = hasAttendance && !isNormalized && !isPending && !isPastDeadline
      return {
        date,
        dateKey,
        ...config,
        dayAbbr: format(date, 'EEE').slice(0, 3),
        dateNum: format(date, 'd'),
        fullDate: format(date, 'PPP'),
        isSelectable,
        isPastDeadline: !!isPastDeadline,
        isSelected: selectedDates.has(dateKey),
      }
    })
  }, [allDates, attendanceMap, leaveMap, selectedDates, disabledDateKeys])

  const handleCellClick = (dateKey: string, isSelectable: boolean) => {
    if (!isSelectable) return
    const next = new Set(selectedDates)
    if (next.has(dateKey)) {
      next.delete(dateKey)
    } else {
      next.add(dateKey)
    }
    onSelectionChange(next)
  }

  if (heatmapCells.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No dates in selected range
      </div>
    )
  }

  const MAX_ENTRIES_PER_ROW = 10
  const rows = useMemo(() => {
    const result: typeof heatmapCells[] = []
    for (let i = 0; i < heatmapCells.length; i += MAX_ENTRIES_PER_ROW) {
      result.push(heatmapCells.slice(i, i + MAX_ENTRIES_PER_ROW))
    }
    return result
  }, [heatmapCells])

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click days with attendance to select for normalization. Already normalized or applied (pending) days cannot be selected.
      </p>
      {rows.map((row, rowIndex) => (
        <div key={`heatmap-${rowIndex}`} className="overflow-x-auto -mx-6 px-6">
          <div className="inline-flex gap-1 min-w-fit">
            <TooltipProvider>
              {row.map((cell) => (
                <Tooltip key={cell.dateKey}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleCellClick(cell.dateKey, cell.isSelectable)}
                      className={cn(
                        'w-12 h-12 rounded-md flex flex-col items-center justify-center text-xs font-medium transition-all shrink-0 relative overflow-hidden',
                        !('pendingNormalization' in cell && cell.pendingNormalization) &&
                          cell.status !== 'paid-leave-half' &&
                          cell.status !== 'unpaid-leave-half' &&
                          cell.bgColor,
                        cell.textColor,
                        cell.isSelectable && 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1',
                        !cell.isSelectable && 'cursor-default opacity-90',
                        cell.isPastDeadline && 'opacity-50',
                        cell.isSelected && 'ring-2 ring-primary ring-offset-1'
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
                      ) : cell.status === 'paid-leave-half' || cell.status === 'unpaid-leave-half' ? (
                        <>
                          <div className="absolute inset-0 flex">
                            <div
                              className={cn(
                                'w-1/2',
                                cell.status === 'unpaid-leave-half' ? 'bg-rose-400' : 'bg-cyan-500'
                              )}
                            />
                            <div className="w-1/2 bg-slate-200 dark:bg-slate-700" />
                          </div>
                          <span className="relative z-10 text-[10px] opacity-90">{cell.dayAbbr}</span>
                          <span className="relative z-10 font-semibold text-sm">{cell.dateNum}</span>
                          {cell.isSelected && (
                            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center z-10">
                              <span className="text-[8px] text-primary-foreground">✓</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] opacity-80">{cell.dayAbbr}</span>
                          <span className="font-semibold text-sm">{cell.dateNum}</span>
                          {cell.isSelected && (
                            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center z-10">
                              <span className="text-[8px] text-primary-foreground">✓</span>
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="whitespace-pre-line text-sm">{cell.tooltipText}</div>
                    {cell.isPastDeadline && (
                      <div className="mt-1 text-xs opacity-80">Past application deadline (apply by 5th of next month)</div>
                    )}
                    {cell.isSelectable && !cell.isPastDeadline && (
                      <div className="mt-1 text-xs opacity-80">
                        {cell.isSelected ? 'Click to deselect' : 'Click to select for normalization'}
                      </div>
                    )}
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
          <div className="w-4 h-4 rounded flex overflow-hidden">
            <div className="w-1/2 bg-cyan-500" />
            <div className="w-1/2 bg-slate-200 dark:bg-slate-700" />
          </div>
          <span>Paid half-day leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded flex overflow-hidden">
            <div className="w-1/2 bg-rose-400" />
            <div className="w-1/2 bg-slate-200 dark:bg-slate-700" />
          </div>
          <span>Unpaid half-day leave</span>
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
          <span>Holiday</span>
        </div>
      </div>
    </div>
  )
}
