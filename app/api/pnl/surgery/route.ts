import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, PaidByParty } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSeatCostPerEmployee } from '@/lib/pnl/pnl-config'

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
  if (pl.implantPaidBy !== 'HOSPITAL') {
    exp += pl.implantCost
  }
  if (pl.instrumentsPaidBy !== 'HOSPITAL') {
    exp += pl.instrumentsCost
  }
  return exp
}

type Bucket = { count: number; revenue: number }

function bumpDisease(
  map: Map<string, Map<string, Bucket>>,
  teamId: string,
  key: string,
  share: number
) {
  if (!map.has(teamId)) map.set(teamId, new Map())
  const inner = map.get(teamId)!
  const prev = inner.get(key) ?? { count: 0, revenue: 0 }
  inner.set(key, { count: prev.count + 1, revenue: prev.revenue + share })
}

function bumpCount(map: Map<string, Map<string, number>>, teamId: string, key: string) {
  if (!map.has(teamId)) map.set(teamId, new Map())
  const inner = map.get(teamId)!
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
    if (!hasPermission(user, 'pnl:read') && !hasPermission(user, 'pl:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const view = searchParams.get('view') || 'all' // all | team | bd

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
              {
                AND: [{ plRecord: { surgeryDate: null } }, { surgeryDate: surgeryRange }],
              },
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
                teamId: true,
                team: { select: { id: true, name: true, teamLead: { select: { name: true } } } },
              },
            },
          },
        },
      },
    })

    const diseaseByTeam = new Map<string, Map<string, Bucket>>()
    const circleByTeam = new Map<string, Map<string, number>>()
    const hospitalByTeam = new Map<string, Map<string, number>>()

    const teamMap = new Map<
      string,
      {
        teamId: string
        teamName: string
        teamLeadName: string | null
        surgeries: number
        revenue: number
        expenses: number
        netProfit: number
      }
    >()

    const bdList: {
      bdId: string
      bdName: string
      teamName: string | null
      surgeries: number
      revenue: number
      expenses: number
      netProfit: number
      patients: { leadId: string; leadRef: string; patientName: string; netProfit: number }[]
    }[] = []

    const bdAgg = new Map<
      string,
      {
        bdId: string
        bdName: string
        teamName: string | null
        surgeries: number
        revenue: number
        expenses: number
        patients: (typeof bdList)[0]['patients']
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

      const teamId = pl.lead.bd?.team?.id || 'unassigned'
      const teamName = pl.lead.bd?.team?.name || 'Unassigned'

      const diseaseKey = pl.category || pl.lead.category || 'Unknown'
      const circleKey = pl.circle || pl.lead.circle || 'Unknown'
      const hospitalKey = pl.hospitalName || pl.lead.hospitalName || 'Unknown'

      bumpDisease(diseaseByTeam, teamId, diseaseKey, share)
      bumpCount(circleByTeam, teamId, circleKey)
      bumpCount(hospitalByTeam, teamId, hospitalKey)

      const existingTeam = teamMap.get(teamId)
      if (existingTeam) {
        existingTeam.surgeries += 1
        existingTeam.revenue += share
        existingTeam.expenses += exp
        existingTeam.netProfit += net
      } else {
        teamMap.set(teamId, {
          teamId,
          teamName,
          teamLeadName: pl.lead.bd?.team?.teamLead?.name ?? null,
          surgeries: 1,
          revenue: share,
          expenses: exp,
          netProfit: net,
        })
      }

      const bdId = pl.lead.bdId
      const bdName = pl.lead.bd?.name || 'Unknown'
      const teamNameBd = pl.lead.bd?.team?.name ?? null
      const existingBd = bdAgg.get(bdId)
      if (existingBd) {
        existingBd.surgeries += 1
        existingBd.revenue += share
        existingBd.expenses += exp
        existingBd.patients.push({
          leadId: pl.lead.id,
          leadRef: pl.lead.leadRef,
          patientName: pl.lead.patientName,
          netProfit: net,
        })
      } else {
        bdAgg.set(bdId, {
          bdId,
          bdName,
          teamName: teamNameBd,
          surgeries: 1,
          revenue: share,
          expenses: exp,
          patients: [
            {
              leadId: pl.lead.id,
              leadRef: pl.lead.leadRef,
              patientName: pl.lead.patientName,
              netProfit: net,
            },
          ],
        })
      }
    }

    for (const b of bdAgg.values()) {
      bdList.push({
        ...b,
        netProfit: b.revenue - b.expenses,
      })
    }

    bdList.sort((a, b) => b.netProfit - a.netProfit)
    const teamBreakdown = Array.from(teamMap.values()).sort((a, b) => b.netProfit - a.netProfit)

    const seatRate = await getSeatCostPerEmployee()
    const realTeamIds = teamBreakdown.map((t) => t.teamId).filter((id) => id && id !== 'unassigned')
    const teamMemberCounts = await prisma.team.findMany({
      where: { id: { in: realTeamIds } },
      select: { id: true, _count: { select: { members: true } } },
    })
    const memberCountByTeam = new Map(teamMemberCounts.map((x) => [x.id, x._count.members]))

    /** --- Marketing (Surgery PnL) + lead counts by BD / team --- */
    let totalSurgeryMarketing = 0
    const marketingCostPerBd: Record<string, number> = {}
    const marketingCostPerTeam: Record<string, number> = {}

    let monthsForPnL: { month: number; year: number }[] = []
    if (startDate && endDate) {
      monthsForPnL = calendarMonthsBetween(new Date(startDate), new Date(endDate))
    }

    const mktCat = await prisma.pnLCategory.findFirst({
      where: { type: 'EXPENSE', sourceKey: 'MARKETING', departmentKey: 'SURGERY' },
    })
    if (mktCat && monthsForPnL.length > 0) {
      const entries = await prisma.pnLEntry.findMany({
        where: {
          categoryId: mktCat.id,
          OR: monthsForPnL.map((m) => ({ month: m.month, year: m.year })),
        },
      })
      totalSurgeryMarketing = entries.reduce((s, e) => s + e.amount, 0)
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
            where: { leadDate: leadDateWhere },
            _count: { _all: true },
          })
        : []

    const totalLeads = leadCounts.reduce((s, x) => s + x._count._all, 0)

    const bdIdsForMarketing = leadCounts.map((x) => x.bdId)
    const bdUsers =
      bdIdsForMarketing.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: bdIdsForMarketing } },
            select: { id: true, teamId: true },
          })
        : []
    const teamIdByBd = new Map(bdUsers.map((u) => [u.id, u.teamId]))

    for (const row of leadCounts) {
      const share = totalLeads > 0 ? row._count._all / totalLeads : 0
      marketingCostPerBd[row.bdId] = share * totalSurgeryMarketing
    }

    const leadCountByTeam = new Map<string, number>()
    for (const row of leadCounts) {
      const tid = teamIdByBd.get(row.bdId) ?? 'unassigned'
      leadCountByTeam.set(tid, (leadCountByTeam.get(tid) ?? 0) + row._count._all)
      const prev = marketingCostPerTeam[tid] ?? 0
      marketingCostPerTeam[tid] = prev + (marketingCostPerBd[row.bdId] ?? 0)
    }

    function distToDiseaseArr(m: Map<string, Bucket> | undefined) {
      if (!m) return []
      return [...m.entries()]
        .map(([label, v]) => ({ label, count: v.count, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
    }
    function distToCountArr(m: Map<string, number> | undefined) {
      if (!m) return []
      return [...m.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
    }

    const teamBreakdownEnriched = teamBreakdown.map((t) => {
      const memberCount = t.teamId === 'unassigned' ? 0 : memberCountByTeam.get(t.teamId) ?? 0
      return {
        ...t,
        memberCount,
        seatCost: memberCount * seatRate,
        leadCount: leadCountByTeam.get(t.teamId) ?? 0,
        marketingCost: marketingCostPerTeam[t.teamId] ?? 0,
        diseaseDistribution: distToDiseaseArr(diseaseByTeam.get(t.teamId)),
        circleDistribution: distToCountArr(circleByTeam.get(t.teamId)),
        hospitalDistribution: distToCountArr(hospitalByTeam.get(t.teamId)),
      }
    })

    const bdBreakdownEnriched = bdList.map((b) => ({
      ...b,
      leadCount: leadCounts.find((x) => x.bdId === b.bdId)?._count._all ?? 0,
      marketingCost: marketingCostPerBd[b.bdId] ?? 0,
    }))

    const topTeams = teamBreakdownEnriched.slice(0, 3)
    const bottomTeams = teamBreakdownEnriched.slice(-3).reverse()
    const topBds = [...bdBreakdownEnriched].slice(0, 3)
    const bottomBds = [...bdBreakdownEnriched].slice(-3).reverse()

    return successResponse({
      view,
      surgeryCount,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      avgPerCase: surgeryCount > 0 ? (totalRevenue - totalExpenses) / surgeryCount : 0,
      teamBreakdown: teamBreakdownEnriched,
      seatCostPerEmployee: seatRate,
      bdBreakdown: bdBreakdownEnriched,
      topTeams,
      bottomTeams,
      topBds,
      bottomBds,
      marketingCostPerBd,
      marketingCostPerTeam,
    })
  } catch (error) {
    console.error('pnl/surgery error:', error)
    return errorResponse('Failed to load surgery PnL', 500)
  }
}
