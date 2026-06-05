import type { PrismaClient } from '@/generated/prisma/client'

export type MonthYear = { month: number; year: number }

/** Must match Campaign CPL storage: same string key as digital-marketing CPL API. */
export function cplLookupKey(campaignName: string, month: number, year: number) {
  return `${campaignName}\0${month}\0${year}`
}

/**
 * Load per-campaign per-month CPL.
 * Primary source: DailyCampaignSpend (sum spend / lead count per campaign per month).
 * Fallback: CampaignCPL records (legacy per-campaign monthly CPL).
 */
export async function loadCampaignCplMap(
  prisma: PrismaClient,
  months: MonthYear[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (months.length === 0) return map

  // Build date range from months
  const firstMonth = months[0]
  const lastMonth = months[months.length - 1]
  const rangeStart = new Date(Date.UTC(firstMonth.year, firstMonth.month - 1, 1))
  const rangeEnd = new Date(Date.UTC(lastMonth.year, lastMonth.month, 0, 23, 59, 59, 999))

  // Fetch daily spend records and leads in parallel
  const [dailySpends, leads, legacyCpls] = await Promise.all([
    prisma.dailyCampaignSpend.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
      select: { campaignName: true, date: true, spend: true },
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { leadEntryDate: { gte: rangeStart, lte: rangeEnd } },
          { AND: [{ leadEntryDate: null }, { createdDate: { gte: rangeStart, lte: rangeEnd } }] },
        ],
        campaignName: { not: null },
      },
      select: { campaignName: true, leadEntryDate: true, createdDate: true },
    }),
    prisma.campaignCPL.findMany({
      where: { OR: months.map((m) => ({ month: m.month, year: m.year })) },
      select: { campaignName: true, month: true, year: true, cpl: true },
    }),
  ])

  // Aggregate daily spend by campaign+month
  const spendByCampaignMonth = new Map<string, number>()
  for (const s of dailySpends) {
    const d = new Date(s.date)
    const key = cplLookupKey(s.campaignName, d.getUTCMonth() + 1, d.getUTCFullYear())
    spendByCampaignMonth.set(key, (spendByCampaignMonth.get(key) || 0) + s.spend)
  }

  // Count leads by campaign+month
  const leadsByCampaignMonth = new Map<string, number>()
  for (const l of leads) {
    if (!l.campaignName) continue
    const entryDate = l.leadEntryDate ?? l.createdDate
    if (!entryDate) continue
    const d = new Date(entryDate)
    const key = cplLookupKey(l.campaignName.trim(), d.getMonth() + 1, d.getFullYear())
    leadsByCampaignMonth.set(key, (leadsByCampaignMonth.get(key) || 0) + 1)
  }

  // Derive CPL from daily spend: spend / leads
  const coveredKeys = new Set<string>()
  for (const [key, spend] of spendByCampaignMonth) {
    const leadCount = leadsByCampaignMonth.get(key) || 0
    if (leadCount > 0 && spend > 0) {
      map.set(key, Math.round((spend / leadCount) * 100) / 100)
    }
    coveredKeys.add(key)
  }

  // Fallback: legacy CampaignCPL for campaigns not covered by daily spend
  for (const r of legacyCpls) {
    const key = cplLookupKey(r.campaignName, r.month, r.year)
    if (!coveredKeys.has(key)) {
      map.set(key, r.cpl)
    }
  }

  return map
}

type LeadRow = { bdId: string; campaignName: string | null; leadEntryDate: Date | null; createdDate?: Date | null }

/**
 * Sum CPL × 1 for each lead in range that has a campaign name and a positive CPL for that lead's calendar month.
 * Allocates totals per BD and per manager group (same keys as surgery P&L: 'unassigned' when no manager).
 */
export function allocateCplMarketingByBdAndGroup(
  leads: LeadRow[],
  cplMap: Map<string, number>,
  bdToManagerId: Map<string, string>
): { total: number; perBd: Record<string, number>; perGroup: Record<string, number> } {
  const perBd: Record<string, number> = {}
  const perGroup: Record<string, number> = {}
  let total = 0

  for (const L of leads) {
    const entryDate = L.leadEntryDate ?? L.createdDate
    if (!entryDate) continue
    const name = L.campaignName?.trim()
    if (!name) continue
    const month = entryDate.getMonth() + 1
    const year = entryDate.getFullYear()
    const cpl = cplMap.get(cplLookupKey(name, month, year))
    if (cpl == null || cpl <= 0) continue

    total += cpl
    perBd[L.bdId] = (perBd[L.bdId] ?? 0) + cpl
    const gid = bdToManagerId.get(L.bdId) ?? 'unassigned'
    perGroup[gid] = (perGroup[gid] ?? 0) + cpl
  }

  return { total, perBd, perGroup }
}
