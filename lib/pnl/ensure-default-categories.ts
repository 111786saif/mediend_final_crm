import { prisma } from '@/lib/prisma'
import { ensureDefaultSeatCostConfig } from '@/lib/pnl/pnl-config'
import { PNL_DEPARTMENT_KEYS, PNL_EXPENSE_SOURCE_KEYS } from '@/lib/pnl/constants'

type DeptKey = (typeof PNL_DEPARTMENT_KEYS)[number]

const REVENUE_DEFAULTS: { name: string; sourceKey: string; sortOrder: number }[] = [
  { name: 'Surgery', sourceKey: 'SURGERY', sortOrder: 10 },
  { name: 'IT Projects', sourceKey: 'IT', sortOrder: 20 },
  { name: 'Loan & Demat', sourceKey: 'LOAN_DEMAT', sortOrder: 30 },
  { name: 'Google Ads', sourceKey: 'GOOGLE_ADS', sortOrder: 40 },
]

const EXPENSE_LABELS: Record<(typeof PNL_EXPENSE_SOURCE_KEYS)[number], string> = {
  SALARY: 'Salary',
  SEAT_COST: 'Seat Cost',
  MARKETING: 'Marketing',
  FREELANCERS: 'Freelancers',
  MISC: 'Miscellaneous',
}

const EXPENSE_SORT: Record<(typeof PNL_EXPENSE_SOURCE_KEYS)[number], number> = {
  SALARY: 100,
  SEAT_COST: 110,
  MARKETING: 120,
  FREELANCERS: 130,
  MISC: 140,
}

function expenseSortForDept(dept: DeptKey, sk: (typeof PNL_EXPENSE_SOURCE_KEYS)[number]): number {
  const base = { SURGERY: 0, IT: 200, LOAN_DEMAT: 400, GOOGLE_ADS: 600 }[dept]
  return base + EXPENSE_SORT[sk]
}

export async function ensureDefaultPnLCategories(): Promise<void> {
  await ensureDefaultSeatCostConfig()

  for (const r of REVENUE_DEFAULTS) {
    const existing = await prisma.pnLCategory.findFirst({
      where: { sourceKey: r.sourceKey, departmentKey: null, type: 'REVENUE' },
    })
    if (existing) continue
    await prisma.pnLCategory.create({
      data: {
        name: r.name,
        type: 'REVENUE',
        isSystem: true,
        sortOrder: r.sortOrder,
        isActive: true,
        sourceKey: r.sourceKey,
        departmentKey: null,
      },
    })
  }

  for (const dept of PNL_DEPARTMENT_KEYS) {
    for (const sk of PNL_EXPENSE_SOURCE_KEYS) {
      const existing = await prisma.pnLCategory.findFirst({
        where: { sourceKey: sk, departmentKey: dept, type: 'EXPENSE' },
      })
      if (existing) continue
      await prisma.pnLCategory.create({
        data: {
          name: `${EXPENSE_LABELS[sk]} (${deptLabel(dept)})`,
          type: 'EXPENSE',
          isSystem: true,
          sortOrder: expenseSortForDept(dept, sk),
          isActive: true,
          sourceKey: sk,
          departmentKey: dept,
        },
      })
    }
  }
}

function deptLabel(d: DeptKey): string {
  switch (d) {
    case 'SURGERY':
      return 'Surgery'
    case 'IT':
      return 'IT'
    case 'LOAN_DEMAT':
      return 'Loan/Demat'
    case 'GOOGLE_ADS':
      return 'Google Ads'
    default:
      return d
  }
}
