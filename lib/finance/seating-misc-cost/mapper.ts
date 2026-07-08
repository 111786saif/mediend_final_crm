import type { EmployeeSeatingMiscCostStatus } from '@/generated/prisma/client'
import type { SeatingMiscCostHistoryEntry, SeatingMiscCostRecord } from '@/lib/finance/seating-misc-cost/types'

export const seatingMiscInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      designation: true,
      departmentId: true,
      user: { select: { name: true } },
      department: { select: { name: true } },
    },
  },
} as const

type SeatingMiscRow = {
  id: string
  employeeId: string
  month: number
  year: number
  seatingCost: number
  miscCost: number
  status: EmployeeSeatingMiscCostStatus
  remarks: string | null
  masterSeatingCostId: string | null
  createdAt: Date
  updatedAt: Date
  employee: {
    id: string
    employeeCode: string
    designation: string | null
    departmentId: string | null
    user: { name: string }
    department: { name: string } | null
  }
}

export function mapSeatingMiscRecord(row: SeatingMiscRow): SeatingMiscCostRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.name,
    employeeCode: row.employee.employeeCode,
    department: row.employee.department?.name ?? null,
    departmentId: row.employee.departmentId,
    designation: row.employee.designation,
    seatingCost: row.seatingCost,
    miscCost: row.miscCost,
    month: row.month,
    year: row.year,
    status: row.status,
    remarks: row.remarks,
    masterSeatingCostId: row.masterSeatingCostId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapSeatingMiscHistoryEntry(row: {
  id: string
  action: string
  seatingCost: number
  miscCost: number
  status: EmployeeSeatingMiscCostStatus
  remarks: string | null
  changedAt: Date
  changedBy: { name: string }
}): SeatingMiscCostHistoryEntry {
  return {
    id: row.id,
    action: row.action,
    seatingCost: row.seatingCost,
    miscCost: row.miscCost,
    status: row.status,
    remarks: row.remarks,
    changedBy: row.changedBy.name,
    changedAt: row.changedAt.toISOString(),
  }
}

import { prisma } from '@/lib/prisma'

export async function appendSeatingMiscHistory(
  recordId: string,
  action: string,
  data: {
    seatingCost: number
    miscCost: number
    status: EmployeeSeatingMiscCostStatus
    remarks: string | null
  },
  changedByUserId: string,
) {
  await prisma.employeeMonthlySeatingMiscCostHistory.create({
    data: {
      recordId,
      action,
      seatingCost: data.seatingCost,
      miscCost: data.miscCost,
      status: data.status,
      remarks: data.remarks,
      changedByUserId,
    },
  })
}
