import { AttendanceLog, PunchDirection, type Department } from '@/generated/prisma/client'

export type AttendanceStatus =
  | 'on-time'
  | 'grace-1'
  | 'grace-2'
  | 'late-penalty'
  | 'half-day'

export interface DepartmentTiming {
  shiftStartHour: number
  shiftStartMinute: number
  grace1Minutes: number
  grace2Minutes: number
  penaltyMinutes: number
  penaltyAmount: number
}

export const DEFAULT_DEPARTMENT_TIMING: DepartmentTiming = {
  shiftStartHour: 10,
  shiftStartMinute: 0,
  grace1Minutes: 15,
  grace2Minutes: 15,
  penaltyMinutes: 30,
  penaltyAmount: 200,
}

/** Map a DB Department row (or null) to attendance classification timing. */
export function getDepartmentTiming(department: Department | null | undefined): DepartmentTiming {
  if (!department) return DEFAULT_DEPARTMENT_TIMING
  return {
    shiftStartHour: department.shiftStartHour,
    shiftStartMinute: department.shiftStartMinute,
    grace1Minutes: department.grace1Minutes,
    grace2Minutes: department.grace2Minutes,
    penaltyMinutes: department.penaltyMinutes,
    penaltyAmount: department.penaltyAmount,
  }
}

/** Minimum worked hours to count as a full day (payroll + heatmap must stay aligned). */
export const MIN_FULL_DAY_HOURS = 9

export interface AttendanceClassification {
  status: AttendanceStatus
  penalty: number
  isHalfDay: boolean
  isLate: boolean
}

/**
 * Classify attendance for a single day based on punch-in time, work hours, and department timing.
 * Uses UTC getters for time comparison (no timezone conversion).
 * Rule: Under 9 hours worked is always half-day (including in the late-penalty window).
 * Rule: After the penalty window ends, it is always half-day regardless of hours worked.
 */
export function classifyAttendance(
  punchTime: Date,
  workHours: number | null,
  timing: DepartmentTiming = DEFAULT_DEPARTMENT_TIMING
): AttendanceClassification {
  const punchMinutes = punchTime.getUTCHours() * 60 + punchTime.getUTCMinutes()
  const shiftStartMinutes = timing.shiftStartHour * 60 + timing.shiftStartMinute
  const grace1EndMinutes = shiftStartMinutes + timing.grace1Minutes
  const grace2EndMinutes = grace1EndMinutes + timing.grace2Minutes
  const penaltyEndMinutes = grace2EndMinutes + timing.penaltyMinutes

  const hasEnoughHours = workHours !== null && workHours >= MIN_FULL_DAY_HOURS

  if (punchMinutes < shiftStartMinutes) {
    if (hasEnoughHours) {
      return { status: 'on-time', penalty: 0, isHalfDay: false, isLate: false }
    }
    return { status: 'half-day', penalty: 0, isHalfDay: true, isLate: false }
  }

  if (punchMinutes < grace1EndMinutes) {
    if (hasEnoughHours) {
      return { status: 'grace-1', penalty: 0, isHalfDay: false, isLate: true }
    }
    return { status: 'half-day', penalty: 0, isHalfDay: true, isLate: true }
  }

  if (punchMinutes < grace2EndMinutes) {
    if (hasEnoughHours) {
      return { status: 'grace-2', penalty: 0, isHalfDay: false, isLate: true }
    }
    return { status: 'half-day', penalty: 0, isHalfDay: true, isLate: true }
  }

  if (punchMinutes < penaltyEndMinutes) {
    return {
      status: 'late-penalty',
      penalty: timing.penaltyAmount,
      isHalfDay: !hasEnoughHours,
      isLate: true,
    }
  }

  return {
    status: 'half-day',
    penalty: 0,
    isHalfDay: true,
    isLate: true,
  }
}

export interface AttendanceWithHours {
  date: Date
  inTime: Date | null
  outTime: Date | null
  workHours: number | null
  isLate: boolean
  logs: AttendanceLog[]
  status?: AttendanceStatus
  penalty?: number
  isHalfDay?: boolean
}

export function calculateWorkHours(inTime: Date, outTime: Date | null): number | null {
  if (!outTime) return null
  const diffMs = outTime.getTime() - inTime.getTime()
  return diffMs / (1000 * 60 * 60) // Convert to hours
}

export function isLateArrival(punchTime: Date, timing?: DepartmentTiming): boolean {
  const t = timing ?? DEFAULT_DEPARTMENT_TIMING
  const punchMinutes = punchTime.getUTCHours() * 60 + punchTime.getUTCMinutes()
  const shiftStartMinutes = t.shiftStartHour * 60 + t.shiftStartMinute
  return punchMinutes >= shiftStartMinutes + t.grace1Minutes
}

export function groupAttendanceByDate(
  logs: AttendanceLog[],
  timing?: DepartmentTiming
): AttendanceWithHours[] {
  const grouped = new Map<string, AttendanceWithHours>()

  for (const log of logs) {
    const dateKey = log.logDate.toISOString().split('T')[0]

    if (!grouped.has(dateKey)) {
      const [y, m, d] = dateKey.split('-').map(Number)
      grouped.set(dateKey, {
        date: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
        inTime: null,
        outTime: null,
        workHours: null,
        isLate: false,
        logs: [],
      })
    }

    const day = grouped.get(dateKey)!
    day.logs.push(log)

    if (!day.inTime || log.logDate < day.inTime) {
      day.inTime = log.logDate
      day.isLate = isLateArrival(log.logDate, timing)
    }

    if (!day.outTime || log.logDate > day.outTime) {
      day.outTime = log.logDate
    }
  }

  const t = timing ?? DEFAULT_DEPARTMENT_TIMING

  for (const day of grouped.values()) {
    if (day.logs.length < 2) {
      day.outTime = null
      day.workHours = null
    } else if (day.inTime && day.outTime) {
      day.workHours = calculateWorkHours(day.inTime, day.outTime)
    } else {
      day.workHours = null
    }

    if (day.inTime != null) {
      const classification = classifyAttendance(day.inTime, day.workHours ?? null, t)
      day.status = classification.status
      day.penalty = classification.penalty
      day.isHalfDay = classification.isHalfDay
      day.isLate = classification.isLate
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    b.date.getTime() - a.date.getTime()
  )
}

export function normalizePunchDirection(direction: string): PunchDirection {
  const normalized = direction.toLowerCase().trim()
  if (normalized === 'in' || normalized === '1') {
    return PunchDirection.IN
  }
  if (normalized === 'out' || normalized === '0') {
    return PunchDirection.OUT
  }
  return PunchDirection.IN
}
