/** Minimum worked hours to count as a full day (payroll + heatmap). Safe to import from client components. */
export const MIN_FULL_DAY_HOURS = 9

/** Below this (when hours are known), a day classified as half-day becomes absent instead. */
export const MIN_HALF_DAY_HOURS = 4.5

/** Department shift + grace windows (no Prisma — safe for client components). */
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
