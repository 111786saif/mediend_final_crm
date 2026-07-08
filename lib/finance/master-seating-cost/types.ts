import type { SessionUser } from '@/lib/auth'

export interface MasterSeatingCostRow {
  employeeId: string
  employeeName: string
  employeeCode: string
  department: string | null
  departmentId: string | null
  designation: string | null
  seatingCostId: string | null
  amount: number | null
  updatedAt: string | null
}

export interface MasterSeatingCostResponse {
  rows: MasterSeatingCostRow[]
  departments: { id: string; name: string }[]
}

export function canAccessMasterSeatingCost(user: SessionUser): boolean {
  return user.role === 'FINANCE_HEAD' || user.role === 'ADMIN'
}
