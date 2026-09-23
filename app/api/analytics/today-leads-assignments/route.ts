import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'

/**
 * Get today's lead assignments grouped by BD.
 * Returns count of all leads assigned today (IST).
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    // Get current time in IST (UTC+5:30)
    const now = new Date()
    const istOffsetMs = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffsetMs)

    const istYear = istNow.getUTCFullYear()
    const istMonth = istNow.getUTCMonth()
    const istDay = istNow.getUTCDate()

    const todayStart = new Date(Date.UTC(istYear, istMonth, istDay, 0, 0, 0, 0))
    const todayEnd = new Date(Date.UTC(istYear, istMonth, istDay, 23, 59, 59, 999))

    const todayStartUTC = new Date(todayStart.getTime() - istOffsetMs)
    const todayEndUTC = new Date(todayEnd.getTime() - istOffsetMs)

    const scopeWhere: { bdId?: { in: string[] } } = {}
    if (isSubtreeScopedSalesRole(user.role)) {
      const bdIdFilter = await getSalesDashboardBdIdFilter(user)
      if (bdIdFilter) scopeWhere.bdId = { in: bdIdFilter }
    }

    const leads = await prisma.lead.findMany({
      where: {
        assignedDate: {
          gte: todayStartUTC,
          lte: todayEndUTC,
        },
        ...scopeWhere,
      },
      include: {
        bd: {
          select: {
            id: true,
            name: true,
            email: true,
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
      orderBy: {
        assignedDate: 'desc',
      },
    })

    const bdMap = new Map<
      string,
      {
        bdId: string
        bdName: string
        bdEmail: string
        managerName: string | null
        leadCount: number
        leads: Array<{
          id: number
          leadRef: string
          patientName: string
          assignedDate: Date | null
        }>
      }
    >()

    leads.forEach((lead) => {
      const bdId = lead.bdId
      if (!bdMap.has(bdId)) {
        bdMap.set(bdId, {
          bdId: lead.bd.id,
          bdName: lead.bd.name,
          bdEmail: lead.bd.email,
          managerName: lead.bd.employee?.manager?.user?.name ?? null,
          leadCount: 0,
          leads: [],
        })
      }

      const bdData = bdMap.get(bdId)!
      bdData.leadCount++
      bdData.leads.push({
        id: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
        assignedDate: lead.assignedDate,
      })
    })

    const assignments = Array.from(bdMap.values()).sort((a, b) => b.leadCount - a.leadCount)

    return successResponse({
      date: todayStart.toISOString().split('T')[0],
      totalLeads: leads.length,
      assignments,
    })
  } catch (error) {
    console.error("Error fetching today's lead assignments:", error)
    return errorResponse("Failed to fetch today's lead assignments", 500)
  }
}
