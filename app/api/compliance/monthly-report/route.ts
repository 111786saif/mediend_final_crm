import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ComplianceCallStatus, ConcernCategory, SatisfactionLevel } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CONCERN_CATEGORIES: ConcernCategory[] = [
  ConcernCategory.HOSPITAL_STAFF,
  ConcernCategory.PAYMENT,
  ConcernCategory.BD,
  ConcernCategory.NO_UPDATE_FOLLOWUP,
  ConcernCategory.DOCTOR,
  ConcernCategory.SURGERY_RELATED,
  ConcernCategory.CAB_PAYMENT,
  ConcernCategory.OTHERS,
]

interface MonthRow {
  month: number
  label: string
  totalSurgeries: number
  connected: number
  notConnected: number
  satisfied: number
  notSatisfied: number
  neutral: number
  concerns: Record<ConcernCategory, number>
}

function emptyMonth(month: number): MonthRow {
  const concerns = {} as Record<ConcernCategory, number>
  for (const c of CONCERN_CATEGORIES) concerns[c] = 0
  return {
    month,
    label: MONTH_LABELS[month - 1],
    totalSurgeries: 0,
    connected: 0,
    notConnected: 0,
    satisfied: 0,
    notSatisfied: 0,
    neutral: 0,
    concerns,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
    if (!Number.isFinite(year) || year < 2000 || year > 3000) {
      return errorResponse('Invalid year', 400)
    }

    const start = new Date(Date.UTC(year, 0, 1))
    const end = new Date(Date.UTC(year + 1, 0, 1))

    const calls = await prisma.complianceCall.findMany({
      where: {
        lead: {
          surgeryDate: { gte: start, lt: end },
        },
      },
      select: {
        status: true,
        satisfaction: true,
        concernCategories: true,
        lead: { select: { surgeryDate: true } },
      },
    })

    const months: MonthRow[] = Array.from({ length: 12 }, (_, i) => emptyMonth(i + 1))

    for (const c of calls) {
      const d = c.lead.surgeryDate
      if (!d) continue
      const m = d.getUTCMonth()
      const row = months[m]
      row.totalSurgeries++
      if (c.status === ComplianceCallStatus.COMPLETED) row.connected++
      else row.notConnected++
      if (c.satisfaction === SatisfactionLevel.SATISFIED) row.satisfied++
      else if (c.satisfaction === SatisfactionLevel.NOT_SATISFIED) row.notSatisfied++
      else if (c.satisfaction === SatisfactionLevel.NEUTRAL) row.neutral++
      for (const cat of c.concernCategories) {
        if (cat in row.concerns) row.concerns[cat]++
      }
    }

    return successResponse({ year, months, categories: CONCERN_CATEGORIES })
  } catch (error) {
    console.error('Error generating monthly compliance report:', error)
    return errorResponse('Failed to generate report', 500)
  }
}
