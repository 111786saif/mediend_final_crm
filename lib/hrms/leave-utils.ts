import { LeaveRequest, LeaveBalance, LeaveTypeMaster } from '@/generated/prisma/client'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parse YYYY-MM-DD as a calendar date in the server (or runtime) local timezone. */
export function parseDateOnlyLocal(isoDate: string): Date {
  const m = DATE_ONLY.exec(isoDate.trim())
  if (!m) {
    throw new Error('Invalid date format, expected YYYY-MM-DD')
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return new Date(y, mo - 1, d)
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Inclusive end (local calendar day). After this, CL/EL again require today-or-future only (same as sick leave backdating rules). */
const CL_EL_PAST_BACKDATE_GRACE_END_LOCAL = { year: 2026, monthIndex: 3, day: 10 }

/** Temporary window: non–sick leave types may include past start/end dates through the grace end day. */
export function isClElPastBackdateGraceActive(now: Date = new Date()): boolean {
  const today = startOfLocalDay(now)
  const end = new Date(
    CL_EL_PAST_BACKDATE_GRACE_END_LOCAL.year,
    CL_EL_PAST_BACKDATE_GRACE_END_LOCAL.monthIndex,
    CL_EL_PAST_BACKDATE_GRACE_END_LOCAL.day
  )
  end.setHours(0, 0, 0, 0)
  return today.getTime() <= end.getTime()
}

/** Sick leave (code SL, or legacy rows with no code and "sick" in name) may be backdated. CL/EL cannot. */
export function isSickLeaveType(leaveType: { code?: string | null; name: string }): boolean {
  const c = leaveType.code?.trim().toUpperCase()
  if (c === 'SL') return true
  if (c) return false
  return /sick/i.test(leaveType.name.trim())
}

/** Leave Without Benefits (LWB) - Unpaid Leave where salary is cut and no leads assigned. */
export function isLwbLeaveType(leaveType: { code?: string | null; name: string }): boolean {
  const c = leaveType.code?.trim().toUpperCase()
  if (c === 'LWB') return true
  return /lwb|leave without benefit/i.test(leaveType.name.trim())
}

export interface LeaveBalanceWithType extends LeaveBalance {
  leaveType: LeaveTypeMaster
}

export interface LeaveRequestWithDetails extends LeaveRequest {
  leaveType: LeaveTypeMaster
  employee: {
    id: string
    employeeCode: string
    user: {
      id: string
      name: string
      email: string
    }
  }
}

/** Calculate leave days. Inclusive of start and end. Supports half-days. */
export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  halfDayCount: number = 0
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diffTime = end.getTime() - start.getTime()
  const fullDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return fullDays - halfDayCount * 0.5
}

export function validateLeaveBalance(
  balance: LeaveBalance | null,
  requestedDays: number
): { valid: boolean; error?: string } {
  if (!balance) {
    return { valid: false, error: 'Leave balance not found' }
  }

  if (balance.remaining < requestedDays) {
    return {
      valid: false,
      error: `Insufficient leave balance. Available: ${balance.remaining}, Requested: ${requestedDays}`,
    }
  }

  return { valid: true }
}

export function checkDateConflict(
  existingLeaves: LeaveRequest[],
  startDate: Date,
  endDate: Date
): { hasConflict: boolean; conflictingLeave?: LeaveRequest } {
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (const leave of existingLeaves) {
    if (leave.status !== 'APPROVED' && leave.status !== 'PENDING') continue

    const existingStart = new Date(leave.startDate)
    const existingEnd = new Date(leave.endDate)

    // Check for overlap
    if (
      (start >= existingStart && start <= existingEnd) ||
      (end >= existingStart && end <= existingEnd) ||
      (start <= existingStart && end >= existingEnd)
    ) {
      return { hasConflict: true, conflictingLeave: leave }
    }
  }

  return { hasConflict: false }
}

