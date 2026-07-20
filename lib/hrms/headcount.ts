import type { Prisma } from '@/generated/prisma/client'
import { EmployeeStatus } from '@/generated/prisma/enums'

/** Employee statuses included in roster headcount (currently employed). */
export const HEADCOUNT_EMPLOYEE_STATUSES = [
  EmployeeStatus.ACTIVE,
  EmployeeStatus.ON_PIP,
  EmployeeStatus.ON_NOTICE,
] as const

export type HeadcountEmployeeStatus = (typeof HEADCOUNT_EMPLOYEE_STATUSES)[number]

export const headcountEmployeeWhere: Prisma.EmployeeWhereInput = {
  status: { in: [...HEADCOUNT_EMPLOYEE_STATUSES] },
}

export function isActiveHeadcountEmployee(
  status: EmployeeStatus | string | null | undefined
): boolean {
  if (!status) return false
  return (HEADCOUNT_EMPLOYEE_STATUSES as readonly string[]).includes(status)
}
