import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaidByParty } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

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

type BdSummary = {
  bdName: string
  teamName: string | null
  surgeries: number
  revenue: number
  expenses: number
  netProfit: number
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    // Pull all PLRecords with their lead's BD details
    const records = await prisma.pLRecord.findMany({
      where: {
        lead: { plRecord: { isNot: null } },
      },
      include: {
        lead: {
          select: {
            id: true,
            bdId: true,
            bd: {
              select: {
                id: true,
                name: true,
                employee: {
                  select: {
                    manager: {
                      select: {
                        id: true,
                        user: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const bdMap = new Map<
      string,
      { bdName: string; managerName: string | null; count: number; mediendShare: number; expenses: number }
    >()

    for (const pl of records) {
      const share = pl.mediendShareAmount || 0
      const exp = mediendExpenseForPl(pl)

      const bdId = pl.lead.bdId
      const bdName = pl.lead.bd?.name || 'Unknown'
      const managerName = pl.lead.bd?.employee?.manager?.user?.name ?? null
      const b = bdMap.get(bdId) || { bdName, managerName, count: 0, mediendShare: 0, expenses: 0 }
      b.count += 1
      b.mediendShare += share
      b.expenses += exp
      bdMap.set(bdId, b)
    }

    const list = Array.from(bdMap.values()).map((b) => ({
      bdName: b.bdName,
      teamName: b.managerName,
      surgeries: b.count,
      revenue: b.mediendShare,
      expenses: b.expenses,
      netProfit: b.mediendShare - b.expenses,
    }))

    // Calculate options and limits
    const bdNames = [...new Set(list.map((x) => x.bdName).filter(Boolean))].sort()
    const teamNames = [...new Set(list.map((x) => x.teamName || '—').filter(Boolean))].sort()

    const surgeriesVals = list.map((x) => x.surgeries)
    const revenueVals = list.map((x) => x.revenue)
    const expensesVals = list.map((x) => x.expenses)
    const netProfitVals = list.map((x) => x.netProfit)

    const bounds = {
      surgeries: { min: Math.min(...surgeriesVals, 0), max: Math.max(...surgeriesVals, 0) },
      revenue: { min: Math.min(...revenueVals, 0), max: Math.max(...revenueVals, 0) },
      expenses: { min: Math.min(...expensesVals, 0), max: Math.max(...expensesVals, 0) },
      netProfit: { min: Math.min(...netProfitVals, 0), max: Math.max(...netProfitVals, 0) },
    }

    const bdOptions = bdNames.map((n) => ({ label: n, value: n }))
    const teamOptions = teamNames.map((n) => ({ label: n, value: n }))

    return successResponse({
      filters: [
        { field: 'bd', label: 'BD', filterType: 'multiSelect', filterable: true, options: bdOptions },
        { field: 'team', label: 'Team Leader', filterType: 'multiSelect', filterable: true, options: teamOptions },
        { field: 'surgeries', label: 'Surgeries', filterType: 'numberRange', filterable: true, min: bounds.surgeries.min, max: bounds.surgeries.max },
        { field: 'revenue', label: 'Revenue', filterType: 'numberRange', filterable: true, min: bounds.revenue.min, max: bounds.revenue.max },
        { field: 'expenses', label: 'Expenses', filterType: 'numberRange', filterable: true, min: bounds.expenses.min, max: bounds.expenses.max },
        { field: 'netProfit', label: 'Net Profit', filterType: 'numberRange', filterable: true, min: bounds.netProfit.min, max: bounds.netProfit.max },
      ],
    })
  } catch (error) {
    console.error('[pl-surgery-dashboard filter-config] Error:', error)
    return errorResponse('Failed to fetch surgery dashboard filters config', 500)
  }
}
