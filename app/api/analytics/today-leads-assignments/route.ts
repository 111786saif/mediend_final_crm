import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getLeadPipelineBucket } from '@/lib/pipeline-lead-buckets'

/**
 * Get today's actionable lead assignments grouped by BD
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
    const istOffsetMs = 5.5 * 60 * 60 * 1000 // 5.5 hours in milliseconds
    const istNow = new Date(now.getTime() + istOffsetMs)
    
    // Get IST date components
    const istYear = istNow.getUTCFullYear()
    const istMonth = istNow.getUTCMonth() // 0-11
    const istDay = istNow.getUTCDate()
    
    // Get today's date range in IST (start of day to end of day)
    const todayStart = new Date(Date.UTC(istYear, istMonth, istDay, 0, 0, 0, 0))
    const todayEnd = new Date(Date.UTC(istYear, istMonth, istDay, 23, 59, 59, 999))

    // Convert back to UTC for database query (Prisma uses UTC)
    const todayStartUTC = new Date(todayStart.getTime() - istOffsetMs)
    const todayEndUTC = new Date(todayEnd.getTime() - istOffsetMs)

    const teamScope =
      user.role === 'TEAM_LEAD' && user.teamId ? { bd: { teamId: user.teamId } } : {}

    // Get all leads created today first, then drop inactive statuses.
    const leads = await prisma.lead.findMany({
      where: {
        createdDate: {
          gte: todayStartUTC,
          lte: todayEndUTC,
        },
        ...teamScope,
      },
      include: {
        bd: {
          select: {
            id: true,
            name: true,
            email: true,
            team: {
              select: {
                id: true,
                name: true,
                teamLead: {
                  select: { name: true },
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

    // Group by BD and count
    const bdMap = new Map<
      string,
      {
        bdId: string
        bdName: string
        bdEmail: string
        teamName: string | null
        teamLeadName: string | null
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
          teamName: lead.bd.team?.name || null,
          teamLeadName: lead.bd.team?.teamLead?.name || null,
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

    // Convert map to array and sort by lead count (descending)
    const assignments = Array.from(bdMap.values()).sort((a, b) => b.leadCount - a.leadCount)

    return successResponse({
      date: todayStart.toISOString().split('T')[0],
      totalLeads: activeLeads.length,
      excludedInactiveLeads: leads.length - activeLeads.length,
      assignments,
    })
  } catch (error) {
    console.error('Error fetching today\'s lead assignments:', error)
    return errorResponse('Failed to fetch today\'s lead assignments', 500)
  }
}
