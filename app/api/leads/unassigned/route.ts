import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapStatusCode, mapSourceCode } from '@/lib/mysql-code-mappings'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const circle = searchParams.get('circle')
    const limit = parseInt(searchParams.get('limit') || '100')

    // BDs who are on a department team (have teamId) — pool is for leads on BDs not on a team
    const bdsWithTeams = await prisma.employee.findMany({
      where: {
        teamId: { not: null },
        user: { role: 'BD' },
      },
      select: { userId: true },
    })

    const assignedBdIds = bdsWithTeams.map((e) => e.userId)

    // Get unassigned leads (leads assigned to BDs without teams, or leads not assigned to any BD)
    // Actually, based on schema, all leads must have a bdId, so we'll get leads assigned to BDs without teams
    const where: any = {
      pipelineStage: 'SALES',
      bdId: { notIn: assignedBdIds },
    }

    if (circle) {
      where.circle = circle
    }

    const unassignedLeads = await prisma.lead.findMany({
      where,
      include: {
        bd: {
          select: {
            id: true,
            name: true,
            email: true,
            employee: {
              select: {
                team: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: {
        createdDate: 'desc',
      },
      take: limit,
    })

    // Map status/source; keep bd.team at top level (team lives on employee in DB)
    const mappedLeads = unassignedLeads.map((lead) => {
      const bd = lead.bd
        ? {
            id: lead.bd.id,
            name: lead.bd.name,
            email: lead.bd.email,
            team: lead.bd.employee?.team ?? null,
          }
        : lead.bd
      return {
        ...lead,
        bd,
        status: mapStatusCode(lead.status),
        source: lead.source ? mapSourceCode(lead.source) : lead.source,
      }
    })

    return successResponse(mappedLeads)
  } catch (error) {
    console.error('Error fetching unassigned leads:', error)
    return errorResponse('Failed to fetch unassigned leads', 500)
  }
}

