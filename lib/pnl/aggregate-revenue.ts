import { prisma } from '@/lib/prisma'
import { monthlyCostForResource } from '@/lib/pnl/it-resource-cost'
import { getSeatCostPerEmployee } from '@/lib/pnl/pnl-config'

export type MonthYear = { month: number; year: number }

function monthYearFromPl(pl: { month: Date | null; surgeryDate: Date | null }): { month: number; year: number } | null {
  const d = pl.surgeryDate || pl.month
  if (!d) return null
  const dt = new Date(d)
  return { month: dt.getMonth() + 1, year: dt.getFullYear() }
}

export async function surgeryRevenueByMonth(months: MonthYear[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const m of months) {
    map.set(`${m.year}-${m.month}`, 0)
  }

  const records = await prisma.pLRecord.findMany({
    select: {
      month: true,
      surgeryDate: true,
      mediendNetProfit: true,
      finalProfit: true,
    },
  })

  for (const pl of records) {
    const my = monthYearFromPl(pl)
    if (!my) continue
    const key = `${my.year}-${my.month}`
    if (!map.has(key)) continue
    const profit = pl.mediendNetProfit || pl.finalProfit || 0
    map.set(key, (map.get(key) || 0) + profit)
  }

  return map
}

export async function itRevenueByMonth(months: MonthYear[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const m of months) {
    map.set(`${m.year}-${m.month}`, 0)
  }

  const bookings = await prisma.iTProjectBooking.findMany({
    select: { month: true, year: true, amount: true },
  })

  for (const b of bookings) {
    const key = `${b.year}-${b.month}`
    if (map.has(key)) {
      map.set(key, (map.get(key) || 0) + (b.amount || 0))
    }
  }

  return map
}

export async function departmentRevenueByMonth(
  department: 'LOAN_DEMAT' | 'GOOGLE_ADS',
  months: MonthYear[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const m of months) {
    map.set(`${m.year}-${m.month}`, 0)
  }

  const rows = await prisma.departmentRevenue.findMany({
    where: { department },
    select: { month: true, year: true, amount: true },
  })

  for (const r of rows) {
    const key = `${r.year}-${r.month}`
    if (map.has(key)) {
      map.set(key, (map.get(key) || 0) + (r.amount || 0))
    }
  }

  return map
}

export async function itSalaryHintByMonth(months: MonthYear[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const m of months) {
    map.set(`${m.year}-${m.month}`, 0)
  }

  const [projects, seatCostPerEmployee] = await Promise.all([
    prisma.iTProject.findMany({
      include: {
        resources: {
          include: { employee: { select: { salary: true } } },
        },
      },
    }),
    getSeatCostPerEmployee(),
  ])

  for (const my of months) {
    let total = 0
    for (const p of projects) {
      for (const r of p.resources) {
        if (r.resourceType !== 'SALARIED') continue
        total += monthlyCostForResource(
          {
            resourceType: r.resourceType,
            allocationPercent: r.allocationPercent,
            paymentType: r.paymentType,
            monthlyCost: r.monthlyCost,
            oneTimeCost: r.oneTimeCost,
            startDate: r.startDate,
            endDate: r.endDate,
            isActive: r.isActive,
            employeeSalary: r.employee?.salary ?? null,
            seatCostApplied: r.seatCostApplied ?? false,
          },
          my.month,
          my.year,
          seatCostPerEmployee
        )
      }
    }
    map.set(`${my.year}-${my.month}`, total)
  }

  return map
}

export function expandMonthRange(startMonth: number, startYear: number, endMonth: number, endYear: number): MonthYear[] {
  const out: MonthYear[] = []
  let y = startYear
  let m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    out.push({ month: m, year: y })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}
