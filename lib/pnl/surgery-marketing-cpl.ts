import type { PrismaClient } from '@/generated/prisma/client'

export type MonthYear = { month: number; year: number }

/** Must match Campaign CPL storage: same string key as digital-marketing CPL API. */
export function cplLookupKey(campaignName: string, month: number, year: number) {
  return `${campaignName}\0${month}\0${year}`
}

export async function loadCampaignCplMap(
  prisma: PrismaClient,
  months: MonthYear[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (months.length === 0) return map

  const rows = await prisma.campaignCPL.findMany({
    where: { OR: months.map((m) => ({ month: m.month, year: m.year })) },
    select: { campaignName: true, month: true, year: true, cpl: true },
  })
  for (const r of rows) {
    map.set(cplLookupKey(r.campaignName, r.month, r.year), r.cpl)
  }
  return map
}

type LeadRow = { bdId: string; campaignName: string | null; leadDate: Date | null }

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
    if (!L.leadDate) continue
    const name = L.campaignName?.trim()
    if (!name) continue
    const month = L.leadDate.getMonth() + 1
    const year = L.leadDate.getFullYear()
    const cpl = cplMap.get(cplLookupKey(name, month, year))
    if (cpl == null || cpl <= 0) continue

    total += cpl
    perBd[L.bdId] = (perBd[L.bdId] ?? 0) + cpl
    const gid = bdToManagerId.get(L.bdId) ?? 'unassigned'
    perGroup[gid] = (perGroup[gid] ?? 0) + cpl
  }

  return { total, perBd, perGroup }
}
