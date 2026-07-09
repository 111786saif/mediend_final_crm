import type { EmployeeIncentiveStatus } from '@/generated/prisma/client'

export type { EmployeeIncentiveStatus }

export interface IncentiveRecord {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  department: string | null
  designation: string | null
  month: number
  year: number
  amount: number
  status: EmployeeIncentiveStatus
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface IncentiveEmployeeOption {
  id: string
  employeeCode: string
  name: string
  department: string | null
  designation: string | null
}

export const INCENTIVE_STATUS_LABEL: Record<EmployeeIncentiveStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PAID: 'Paid',
}

export const INCENTIVE_STATUS_OPTIONS: EmployeeIncentiveStatus[] = ['PENDING', 'APPROVED', 'PAID']

export function formatIncentiveMonthYear(month: number, year: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${months[month - 1] ?? month} ${year}`
}
