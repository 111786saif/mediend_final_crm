import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, PaidByParty } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSeatCostPerEmployee } from '@/lib/pnl/pnl-config'
import { getManagerGroups } from '@/lib/hierarchy'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'
import {
  allocateCplMarketingByBdAndGroup,
  loadCampaignCplMap,
} from '@/lib/pnl/surgery-marketing-cpl'

function mediendExpenseForPl(pl: {
  cabCharges: number
  dcCharges: number
  referralAmount: number
  doctorCharges: number
  implantCost: number
  instrumentsCost: number
  implantPaidBy: PaidByParty | null
  instrumentsPaidBy: PaidByParty | null
}): number {
  let exp = pl.cabCharges + pl.dcCharges + pl.referralAmount + pl.doctorCharges
  if (pl.implantPaidBy !== 'HOSPITAL') exp += pl.implantCost
  if (pl.instrumentsPaidBy !== 'HOSPITAL') exp += pl.instrumentsCost
  return exp
}

type Bucket = { count: number; revenue: number }

function bumpDisease(map: Map<string, Map<string, Bucket>>, groupId: string, key: string, share: number) {
  if (!map.has(groupId)) map.set(groupId, new Map())
  const inner = map.get(groupId)!
  const prev = inner.get(key) ?? { count: 0, revenue: 0 }
  inner.set(key, { count: prev.count + 1, revenue: prev.revenue + share })
}

function bumpCount(map: Map<string, Map<string, number>>, groupId: string, key: string) {
  if (!map.has(groupId)) map.set(groupId, new Map())
  const inner = map.get(groupId)!
  inner.set(key, (inner.get(key) ?? 0) + 1)
}

function calendarMonthsBetween(start: Date, end: Date): { month: number; year: number }[] {
  const out: { month: number; year: number }[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const endM = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur <= endM) {
    out.push({ month: cur.getMonth() + 1, year: cur.getFullYear() })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (
      !hasPermission(user, 'pnl:read') &&
      !hasPermission(user, 'pl:read') &&
      !hasPermission(user, 'sales:pnl:read')
    ) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const view = searchParams.get('view') || 'all'

    const surgeryRange: Prisma.DateTimeFilter = {}
    if (startDate) surgeryRange.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      surgeryRange.lte = end
    }

    const leadWhere: Prisma.LeadWhereInput = {
      plRecord: { isNot: null },
      ...(Object.keys(surgeryRange).length > 0
        ? {
            OR: [
              { plRecord: { surgeryDate: surgeryRange } },
              { AND: [{ plRecord: { surgeryDate: null } }, { surgeryDate: surgeryRange }] },
            ],
          }
        : {}),
    }

    const records = await prisma.pLRecord.findMany({
      where: { lead: leadWhere },
      include: {
        lead: {
          select: {
            id: true,
            patientName: true,
            leadRef: true,
            bdId: true,
            category: true,
            circle: true,
            hospitalName: true,
            bd: {
              select: {
                id: true,
                name: true,
                employee: {
                  select: {
                    manager: { select: { id: true, user: { select: { name: true } } } },
                    team: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    // Build manager groups lookup: bdUserId → managerId
    const managerGroups = await getManagerGroups()
    const bdToManagerId = new Map<string, string>()
    const managerIdToGroup = new Map<string, typeof managerGroups[0]>()
    for (const group of managerGroups) {
      managerIdToGroup.set(group.managerId, group)
      for (const sub of group.subordinates) {
        bdToManagerId.set(sub.userId, group.managerId)
      }
    }

    const canonicalSalesCount = Object.keys(surgeryRange).length > 0
      ? await prisma.lead.count({ where: canonicalSalesCompletedWhere(surgeryRange) })
      : await prisma.lead.count({ where: { pipelineStage: { in: ['PL', 'COMPLETED'] } } })

    const canonicalPerGroup = new Map<string, number>()
    const salesLeads = await prisma.lead.findMany({
      where: canonicalSalesCompletedWhere(
        Object.keys(surgeryRange).length > 0 ? surgeryRange : {},
      ),
      select: { bdId: true },
    })
    for (const l of salesLeads) {
      const gid = bdToManagerId.get(l.bdId) ?? 'unassigned'
      canonicalPerGroup.set(gid, (canonicalPerGroup.get(gid) ?? 0) + 1)
    }

    const diseaseByGroup = new Map<string, Map<string, Bucket>>()
    const circleByGroup = new Map<string, Map<string, number>>()
    const hospitalByGroup = new Map<string, Map<string, number>>()

    const groupMap = new Map<
      string,
      { groupId: string; groupName: string; managerName: string; surgeries: number; revenue: number; expenses: number; netProfit: number }
    >()

    const bdAgg = new Map<
      string,
      {
        bdId: string
        bdName: string
        managerName: string | null
        teamName: string | null
        surgeries: number
        revenue: number
        expenses: number
        patients: { leadId: string; leadRef: string; patientName: string; netProfit: number }[]
      }
    >()

    let totalRevenue = 0
    let totalExpenses = 0
    let surgeryCount = 0

    for (const pl of records) {
      const share = pl.mediendShareAmount || 0
      const exp = mediendExpenseForPl(pl)
      const net = share - exp
      totalRevenue += share
      totalExpenses += exp
      surgeryCount += 1

      const bdId = pl.lead.bdId
      const bdName = pl.lead.bd?.name || 'Unknown'
      const managerName = pl.lead.bd?.employee?.manager?.user?.name ?? null
      const teamName = pl.lead.bd?.employee?.team?.name ?? null
      const managerId = bdToManagerId.get(bdId) ?? 'unassigned'
      const group = managerIdToGroup.get(managerId)
      const groupName = group ? `${group.managerName}'s Team` : 'Unassigned'
      const groupManagerName = group?.managerName ?? 'Unassigned'

      const diseaseKey = pl.category || pl.lead.category || 'Unknown'
      const circleKey = pl.circle || pl.lead.circle || 'Unknown'
      const hospitalKey = pl.hospitalName || pl.lead.hospitalName || 'Unknown'

      bumpDisease(diseaseByGroup, managerId, diseaseKey, share)
      bumpCount(circleByGroup, managerId, circleKey)
      bumpCount(hospitalByGroup, managerId, hospitalKey)

      const existingGroup = groupMap.get(managerId)
      if (existingGroup) {
        existingGroup.surgeries += 1
        existingGroup.revenue += share
        existingGroup.expenses += exp
        existingGroup.netProfit += net
      } else {
        groupMap.set(managerId, { groupId: managerId, groupName, managerName: groupManagerName, surgeries: 1, revenue: share, expenses: exp, netProfit: net })
      }

      const existingBd = bdAgg.get(bdId)
      if (existingBd) {
        existingBd.surgeries += 1
        existingBd.revenue += share
        existingBd.expenses += exp
        existingBd.patients.push({ leadId: pl.lead.id, leadRef: pl.lead.leadRef, patientName: pl.lead.patientName, netProfit: net })
        if (!existingBd.teamName && teamName) existingBd.teamName = teamName
      } else {
        bdAgg.set(bdId, {
          bdId,
          bdName,
          managerName,
          teamName,
          surgeries: 1,
          revenue: share,
          expenses: exp,
          patients: [{ leadId: pl.lead.id, leadRef: pl.lead.leadRef, patientName: pl.lead.patientName, netProfit: net }],
        })
      }
    }

    const bdList = Array.from(bdAgg.values()).map((b) => ({ ...b, netProfit: b.revenue - b.expenses }))
    bdList.sort((a, b) => b.netProfit - a.netProfit)
    const groupBreakdown = Array.from(groupMap.values()).sort((a, b) => b.netProfit - a.netProfit)

    const seatRate = await getSeatCostPerEmployee()

    // Member counts by manager group
    const memberCountByGroup = new Map<string, number>()
    for (const group of managerGroups) {
      memberCountByGroup.set(group.managerId, group.subordinates.length)
    }

    const marketingCostPerBd: Record<string, number> = {}
    const marketingCostPerGroup: Record<string, number> = {}

    let monthsInRange: { month: number; year: number }[] = []
    if (startDate && endDate) {
      monthsInRange = calendarMonthsBetween(new Date(startDate), new Date(endDate))
    }

    const leadDateWhere: Prisma.DateTimeFilter = {}
    if (startDate) leadDateWhere.gte = new Date(startDate)
    if (endDate) {
      const e = new Date(endDate)
      e.setHours(23, 59, 59, 999)
      leadDateWhere.lte = e
    }

    const leadCounts =
      Object.keys(leadDateWhere).length > 0
        ? await prisma.lead.groupBy({
            by: ['bdId'],
            where: {
              OR: [
                { leadEntryDate: leadDateWhere },
                { AND: [{ leadEntryDate: null }, { createdDate: leadDateWhere }] },
              ],
            },
            _count: { _all: true },
          })
        : []

    const leadCountByGroup = new Map<string, number>()
    for (const row of leadCounts) {
      const gid = bdToManagerId.get(row.bdId) ?? 'unassigned'
      leadCountByGroup.set(gid, (leadCountByGroup.get(gid) ?? 0) + row._count._all)
    }

    let totalMarketingCostCpl = 0
    if (monthsInRange.length > 0 && Object.keys(leadDateWhere).length > 0) {
      const cplMap = await loadCampaignCplMap(prisma, monthsInRange)
      const leadsForCpl = await prisma.lead.findMany({
        where: {
          OR: [
            { leadEntryDate: leadDateWhere },
            { AND: [{ leadEntryDate: null }, { createdDate: leadDateWhere }] },
          ],
          campaignName: { not: null },
        },
        select: { bdId: true, campaignName: true, leadEntryDate: true, createdDate: true },
      })
      const { total, perBd, perGroup } = allocateCplMarketingByBdAndGroup(
        leadsForCpl,
        cplMap,
        bdToManagerId
      )
      totalMarketingCostCpl = total
      Object.assign(marketingCostPerBd, perBd)
      Object.assign(marketingCostPerGroup, perGroup)
    }

    function distToDiseaseArr(m: Map<string, Bucket> | undefined) {
      if (!m) return []
      return [...m.entries()].map(([label, v]) => ({ label, count: v.count, revenue: v.revenue })).sort((a, b) => b.revenue - a.revenue)
    }
    function distToCountArr(m: Map<string, number> | undefined) {
      if (!m) return []
      return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    }

    const groupBreakdownEnriched = groupBreakdown.map((t) => {
      const memberCount = t.groupId === 'unassigned' ? 0 : (memberCountByGroup.get(t.groupId) ?? 0)
      return {
        ...t,
        memberCount,
        seatCost: memberCount * seatRate,
        leadCount: leadCountByGroup.get(t.groupId) ?? 0,
        marketingCost: marketingCostPerGroup[t.groupId] ?? 0,
        canonicalSalesCount: canonicalPerGroup.get(t.groupId) ?? 0,
        diseaseDistribution: distToDiseaseArr(diseaseByGroup.get(t.groupId)),
        circleDistribution: distToCountArr(circleByGroup.get(t.groupId)),
        hospitalDistribution: distToCountArr(hospitalByGroup.get(t.groupId)),
      }
    })

    const bdBreakdownEnriched = bdList.map((b) => ({
      ...b,
      leadCount: leadCounts.find((x) => x.bdId === b.bdId)?._count._all ?? 0,
      marketingCost: marketingCostPerBd[b.bdId] ?? 0,
    }))

    return successResponse({
      view,
      surgeryCount,
      salesSurgeryCount: canonicalSalesCount,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      avgPerCase: surgeryCount > 0 ? (totalRevenue - totalExpenses) / surgeryCount : 0,
      totalMarketingCostCpl,
      teamBreakdown: groupBreakdownEnriched,
      seatCostPerEmployee: seatRate,
      bdBreakdown: bdBreakdownEnriched,
      topTeams: groupBreakdownEnriched.slice(0, 3),
      bottomTeams: groupBreakdownEnriched.slice(-3).reverse(),
      topBds: [...bdBreakdownEnriched].slice(0, 3),
      bottomBds: [...bdBreakdownEnriched].slice(-3).reverse(),
      marketingCostPerBd,
      marketingCostPerTeam: marketingCostPerGroup,
    })
  } catch (error) {
    console.error('pnl/surgery error:', error)
    return errorResponse('Failed to load surgery PnL', 500)
  }
}
