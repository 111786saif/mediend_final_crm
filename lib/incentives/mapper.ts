import type { EmployeeIncentiveStatus } from '@/generated/prisma/client'
import type { IncentiveRecord } from '@/lib/incentives/types'

type IncentiveRow = {
  id: string
  employeeId: string
  month: number
  year: number
  amount: number
  status: EmployeeIncentiveStatus
  note: string | null
  createdAt: Date
  updatedAt: Date
  employee: {
    employeeCode: string
    designation: string | null
    user: { name: string }
    department: { name: string } | null
  }
}

export function mapIncentiveRecord(row: IncentiveRow): IncentiveRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.name,
    employeeCode: row.employee.employeeCode,
    department: row.employee.department?.name ?? null,
    designation: row.employee.designation,
    month: row.month,
    year: row.year,
    amount: row.amount,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const incentiveEmployeeSelect = {
  id: true,
  employeeCode: true,
  designation: true,
  user: { select: { name: true } },
  department: { select: { name: true } },
} as const

export const incentiveInclude = {
  employee: {
    select: incentiveEmployeeSelect,
  },
} as const
