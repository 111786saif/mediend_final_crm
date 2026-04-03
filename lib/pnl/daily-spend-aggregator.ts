import { prisma } from '@/lib/prisma'
import type { MonthYear } from './aggregate-revenue'

/**
 * Sum all DailyCampaignSpend records per month.
 * Returns Map<"year-month", totalSpend>.
 */
export async function marketingSpendByMonth(months: MonthYear[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const m of months) {
    map.set(`${m.year}-${m.month}`, 0)
  }

  if (months.length === 0) return map

  // Build overall date range
  const firstMonth = months[0]
  const lastMonth = months[months.length - 1]
  const rangeStart = new Date(Date.UTC(firstMonth.year, firstMonth.month - 1, 1))
  const rangeEnd = new Date(Date.UTC(lastMonth.year, lastMonth.month, 0, 23, 59, 59, 999))

  const records = await prisma.dailyCampaignSpend.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
    select: { date: true, spend: true },
  })

  for (const r of records) {
    const d = new Date(r.date)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
    if (map.has(key)) {
      map.set(key, (map.get(key) || 0) + r.spend)
    }
  }

  return map
}
