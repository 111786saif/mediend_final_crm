import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'analytics:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const baseWhere: Prisma.LeadWhereInput = {
      ...leadEntryDateFilter,
    }

    // Role-based filtering
    if (user.role === 'BD') {
      baseWhere.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      baseWhere.bdId = { in: [user.id, ...subIds] }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fourteenDaysAgo = new Date(today)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    // Stagnant leads in SALES stage (>30 days)
    const leadsStuckInSales = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        pipelineStage: 'SALES',
        OR: [
          { leadEntryDate: { lt: thirtyDaysAgo } },
          { AND: [{ leadEntryDate: { equals: null } }, { createdDate: { lt: thirtyDaysAgo } }] },
        ],
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        billAmount: true,
        createdDate: true,
        bd: {
          select: {
            name: true,
          },
        },
      },
      take: 50, // Limit to top 50
    })

    // Stagnant leads in INSURANCE stage (>14 days)
    const leadsStuckInInsurance = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        pipelineStage: 'INSURANCE',
        OR: [
          { leadEntryDate: { lt: fourteenDaysAgo } },
          { AND: [{ leadEntryDate: { equals: null } }, { createdDate: { lt: fourteenDaysAgo } }] },
        ],
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        billAmount: true,
        createdDate: true,
        bd: {
          select: {
            name: true,
          },
        },
      },
      take: 50,
    })

    // Overdue follow-ups
    const overdueFollowUps = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        followUpDate: {
          lt: today,
        },
        pipelineStage: { in: ['SALES', 'INSURANCE', 'PL'] },
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        followUpDate: true,
        billAmount: true,
        bd: {
          select: {
            name: true,
          },
        },
      },
      take: 50,
    })

    // DNP leads (potential losses)
    const dnpLeads = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        status: {
          contains: 'DNP',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        status: true,
        billAmount: true,
        bd: {
          select: {
            name: true,
          },
        },
      },
      take: 50,
    })

    // High-value leads at risk (high ticket size, not moving)
    const highValueAtRisk = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        pipelineStage: { in: ['SALES', 'INSURANCE'] },
        billAmount: { gt: 100000 }, // High value threshold
        createdDate: { lt: fourteenDaysAgo },
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        billAmount: true,
        pipelineStage: true,
        createdDate: true,
        bd: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        billAmount: 'desc',
      },
      take: 50,
    })

    // Critical leads (combining all risk factors)
    const criticalLeads = [
      ...leadsStuckInSales.map((lead) => ({
        ...lead,
        riskType: 'Stuck in SALES',
        daysStuck: Math.floor((today.getTime() - lead.createdDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      ...leadsStuckInInsurance.map((lead) => ({
        ...lead,
        riskType: 'Stuck in INSURANCE',
        daysStuck: Math.floor((today.getTime() - lead.createdDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      ...overdueFollowUps.map((lead) => ({
        ...lead,
        riskType: 'Overdue Follow-up',
        daysStuck: lead.followUpDate
          ? Math.floor((today.getTime() - lead.followUpDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      })),
      ...highValueAtRisk.map((lead) => ({
        ...lead,
        riskType: 'High Value At Risk',
        daysStuck: Math.floor((today.getTime() - lead.createdDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    ]
      .sort((a, b) => (b.billAmount || 0) - (a.billAmount || 0))
      .slice(0, 100) // Top 100 critical leads

    return successResponse({
      atRiskLeads: {
        leadsStuckInSales: leadsStuckInSales.length,
        leadsStuckInInsurance: leadsStuckInInsurance.length,
        overdueFollowUps: overdueFollowUps.length,
        dnpLeads: dnpLeads.length,
        highValueAtRisk: highValueAtRisk.length,
      },
      criticalLeads: criticalLeads.map((lead) => ({
        id: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
        riskType: lead.riskType,
        daysStuck: lead.daysStuck,
        billAmount: lead.billAmount || 0,
        bdName: lead.bd?.name || 'Unknown',
      })),
    })
  } catch (error) {
    console.error('Error fetching risk alerts:', error)
    return errorResponse('Failed to fetch risk alerts', 500)
  }
}
