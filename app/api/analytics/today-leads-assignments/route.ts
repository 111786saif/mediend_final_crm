import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getLeadPipelineBucket } from '@/lib/pipeline-lead-buckets'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

/**
 * Get today's actionable lead assignments grouped by BD.
 * Returns count of leads assigned today (IST), excluding inactive statuses
 * like Junk, Lost, and DNP which should not appear as "new leads".
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
    if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      scopeWhere.bdId = { in: [user.id, ...subIds] }
    }

    const leads = await prisma.lead.findMany({
      where: {
        createdDate: {
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
        createdDate: 'desc',
      },
    })

    const activeLeads = leads.filter((lead) => {
      const bucket = getLeadPipelineBucket(lead.status)
      return bucket !== 'junk' && bucket !== 'lost' && bucket !== 'dnp'
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
          id: string
          leadRef: string
          patientName: string
          createdDate: Date
        }>
      }
    >()

    activeLeads.forEach((lead) => {
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
        createdDate: lead.createdDate,
      })
    })

    const assignments = Array.from(bdMap.values()).sort((a, b) => b.leadCount - a.leadCount)

    return successResponse({
      date: todayStart.toISOString().split('T')[0],
      totalLeads: activeLeads.length,
      excludedInactiveLeads: leads.length - activeLeads.length,
      assignments,
    })
  } catch (error) {
    console.error("Error fetching today's lead assignments:", error)
    return errorResponse("Failed to fetch today's lead assignments", 500)
  }
}
