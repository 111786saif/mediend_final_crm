import type { EmployeeSeatingMiscCostStatus } from '@/generated/prisma/client'

export type { EmployeeSeatingMiscCostStatus }

export interface SeatingMiscCostRecord {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  department: string | null
  departmentId: string | null
  designation: string | null
  seatingCost: number
  miscCost: number
  month: number
  year: number
  status: EmployeeSeatingMiscCostStatus
  remarks: string | null
  masterSeatingCostId: string | null
  createdAt: string
  updatedAt: string
}

/** Row for listing: active employee merged with optional monthly record. */
export interface SeatingMiscCostRow {
  employeeId: string
  employeeName: string
  employeeCode: string
  department: string | null
  departmentId: string | null
  designation: string | null
  recordId: string | null
  seatingCost: number | null
  miscCost: number | null
  month: number
  year: number
  status: EmployeeSeatingMiscCostStatus | null
  remarks: string | null
  /** Master seating amount available for this employee (for add flow). */
  masterSeatingAmount: number | null
  masterSeatingCostId: string | null
}

export interface SeatingMiscCostHistoryEntry {
  id: string
  action: string
  seatingCost: number
  miscCost: number
  status: EmployeeSeatingMiscCostStatus
  remarks: string | null
  changedBy: string
  changedAt: string
}

export interface SeatingMiscCostResponse {
  rows: SeatingMiscCostRow[]
  departments: { id: string; name: string }[]
  month: number
  year: number
}

export const SEATING_MISC_STATUS_LABEL: Record<EmployeeSeatingMiscCostStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PAID: 'Paid',
}

export const SEATING_MISC_STATUS_OPTIONS: EmployeeSeatingMiscCostStatus[] = [
  'PENDING',
  'APPROVED',
  'PAID',
]

export function formatSeatingMiscMonthYear(month: number, year: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${months[month - 1] ?? month} ${year}`
}

/** Statuses included in Sales Team Cost rollups. */
export const SALES_TEAM_COST_SEATING_MISC_STATUSES: EmployeeSeatingMiscCostStatus[] = [
  'APPROVED',
  'PAID',
]
