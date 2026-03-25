import { prisma } from '@/lib/prisma'
import { PNL_DEPARTMENT_KEYS, type PnlDepartmentKey } from '@/lib/pnl/constants'
import type { MonthYear } from '@/lib/pnl/aggregate-revenue'

/** Map HR department name → P&L bucket (first match wins; each employee counted at most once) */
export function classifyEmployeeDepartment(deptName: string | null): PnlDepartmentKey | null {
  const n = (deptName || '').toLowerCase()
  if (!n.trim()) return null
  if (/\bit\b|information|technology|software|developer|engineering/.test(n)) return 'IT'
  if (/loan|demat/.test(n)) return 'LOAN_DEMAT'
  if (/google|ads|marketing|digital|seo|ppc/.test(n)) return 'GOOGLE_ADS'
  if (/surgery|sales|\bbd\b|business development/.test(n)) return 'SURGERY'
  return null
}

export async function getEmployeeCountByPnlDepartment(): Promise<Record<PnlDepartmentKey, number>> {
  const counts: Record<PnlDepartmentKey, number> = {
    SURGERY: 0,
    IT: 0,
    LOAN_DEMAT: 0,
    GOOGLE_ADS: 0,
  }

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { department: { select: { name: true } } },
  })

  for (const e of employees) {
    const key = classifyEmployeeDepartment(e.department?.name ?? null)
    if (key) counts[key] += 1
  }

  return counts
}

/** Seat cost hint per month-key (same headcount applied to each month in range) */
export function buildSeatCostHintsByMonth(
  months: MonthYear[],
  headcount: Record<PnlDepartmentKey, number>,
  seatCostPerEmployee: number
): Record<PnlDepartmentKey, Record<string, number>> {
  const out: Record<PnlDepartmentKey, Record<string, number>> = {
    SURGERY: {},
    IT: {},
    LOAN_DEMAT: {},
    GOOGLE_ADS: {},
  }
  for (const d of PNL_DEPARTMENT_KEYS) {
    const perMonth = headcount[d] * seatCostPerEmployee
    for (const my of months) {
      const k = `${my.year}-${my.month}`
      out[d][k] = perMonth
    }
  }
  return out
}

export type SalesTeamSeatRow = {
  teamId: string
  teamName: string
  memberCount: number
  seatCost: number
}

/** Sales `Team` member counts × seat rate (for surgery team drill-down) */
export async function getSalesTeamSeatCosts(seatCostPerEmployee: number): Promise<SalesTeamSeatRow[]> {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { members: true } },
    },
    orderBy: { name: 'asc' },
  })
  return teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    memberCount: t._count.members,
    seatCost: t._count.members * seatCostPerEmployee,
  }))
}
