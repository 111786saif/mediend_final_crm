import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'

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
    } else if (isSubtreeScopedSalesRole(user.role)) {
      const bdIdFilter = await getSalesDashboardBdIdFilter(user)
      if (bdIdFilter) baseWhere.bdId = { in: bdIdFilter }
    }

    // Lead Velocity - Stage transition times
    const leadsWithStages = await prisma.lead.findMany({
      where: {
        ...baseWhere,
        pipelineStage: { in: ['INSURANCE', 'PL', 'COMPLETED'] },
      },
      select: {
        id: true,
        createdDate: true,
        conversionDate: true,
        pipelineStage: true,
        stageEvents: {
          orderBy: { changedAt: 'asc' },
          select: {
            fromStage: true,
            toStage: true,
            changedAt: true,
          },
        },
      },
    })

    const stageTransitions: {
      salesToInsurance: number[]
      insuranceToPL: number[]
      plToCompleted: number[]
      endToEnd: number[]
    } = {
      salesToInsurance: [],
      insuranceToPL: [],
      plToCompleted: [],
      endToEnd: [],
    }

    leadsWithStages.forEach((lead) => {
      if (lead.conversionDate && lead.createdDate) {
        const endToEnd = Math.floor(
          (lead.conversionDate.getTime() - lead.createdDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        stageTransitions.endToEnd.push(endToEnd)
      }

      // Calculate stage transitions from stage events
      const events = lead.stageEvents.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
      
      // Find specific stage transitions
      events.forEach((event) => {
        if (event.fromStage === 'SALES' && event.toStage === 'INSURANCE') {
          // Find the most recent event where lead entered SALES stage
          const salesEntryEvents = events.filter((e) => e.toStage === 'SALES' && e.changedAt <= event.changedAt)
          const salesEntryEvent = salesEntryEvents[salesEntryEvents.length - 1]
          if (salesEntryEvent) {
            const days = Math.floor(
              (event.changedAt.getTime() - salesEntryEvent.changedAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            stageTransitions.salesToInsurance.push(days)
          }
        } else if (event.fromStage === 'INSURANCE' && event.toStage === 'PL') {
          // Find the most recent event where lead entered INSURANCE stage
          const insuranceEntryEvents = events.filter((e) => e.toStage === 'INSURANCE' && e.changedAt <= event.changedAt)
          const insuranceEntryEvent = insuranceEntryEvents[insuranceEntryEvents.length - 1]
          if (insuranceEntryEvent) {
            const days = Math.floor(
              (event.changedAt.getTime() - insuranceEntryEvent.changedAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            stageTransitions.insuranceToPL.push(days)
          }
        } else if (event.fromStage === 'PL' && event.toStage === 'COMPLETED') {
          // Find the most recent event where lead entered PL stage
          const plEntryEvents = events.filter((e) => e.toStage === 'PL' && e.changedAt <= event.changedAt)
          const plEntryEvent = plEntryEvents[plEntryEvents.length - 1]
          if (plEntryEvent) {
            const days = Math.floor(
              (event.changedAt.getTime() - plEntryEvent.changedAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            stageTransitions.plToCompleted.push(days)
          }
        }
      })
    })

    const avgSalesToInsurance =
      stageTransitions.salesToInsurance.length > 0
        ? stageTransitions.salesToInsurance.reduce((a, b) => a + b, 0) / stageTransitions.salesToInsurance.length
        : 0
    const avgInsuranceToPL =
      stageTransitions.insuranceToPL.length > 0
        ? stageTransitions.insuranceToPL.reduce((a, b) => a + b, 0) / stageTransitions.insuranceToPL.length
        : 0
    const avgPLToCompleted =
      stageTransitions.plToCompleted.length > 0
        ? stageTransitions.plToCompleted.reduce((a, b) => a + b, 0) / stageTransitions.plToCompleted.length
        : 0
    const avgEndToEnd =
      stageTransitions.endToEnd.length > 0
        ? stageTransitions.endToEnd.reduce((a, b) => a + b, 0) / stageTransitions.endToEnd.length
        : 0

    // Follow-up Compliance
    const leadsRequiringFollowUp = await prisma.lead.count({
      where: {
        ...baseWhere,
        pipelineStage: { in: ['SALES', 'INSURANCE'] },
      },
    })

    const leadsWithScheduledFollowUp = await prisma.lead.count({
      where: {
        ...baseWhere,
        followUpDate: { not: null },
      },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const overdueFollowUps = await prisma.lead.count({
      where: {
        ...baseWhere,
        followUpDate: {
          lt: today,
        },
        pipelineStage: { in: ['SALES', 'INSURANCE'] },
      },
    })

    const complianceRate =
      leadsRequiringFollowUp > 0 ? (leadsWithScheduledFollowUp / leadsRequiringFollowUp) * 100 : 0

    // Data Quality Metrics
    const allLeads = await prisma.lead.findMany({
      where: baseWhere,
      select: {
        phoneNumber: true,
        patientEmail: true,
        alternateNumber: true,
        insuranceName: true,
        treatment: true,
        duplCount: true,
        status: true,
      },
    })

    const dataQuality = {
      leadsWithPhone: allLeads.filter((l) => l.phoneNumber).length,
      leadsWithEmail: allLeads.filter((l) => l.patientEmail).length,
      leadsWithAlternate: allLeads.filter((l) => l.alternateNumber).length,
      leadsWithInsurance: allLeads.filter((l) => l.insuranceName).length,
      leadsWithTreatment: allLeads.filter((l) => l.treatment).length,
      duplicateLeads: allLeads.filter((l) => (l.duplCount || 0) > 0).length,
      invalidNumbers: allLeads.filter((l) => l.status?.toLowerCase().includes('invalid')).length,
    }

    const totalLeads = allLeads.length
    const completenessScore =
      totalLeads > 0
        ? ((dataQuality.leadsWithPhone +
            dataQuality.leadsWithEmail +
            dataQuality.leadsWithAlternate +
            dataQuality.leadsWithInsurance +
            dataQuality.leadsWithTreatment) /
            (totalLeads * 5)) *
          100
        : 0

    // BD Compliance rates
    const bdCompliance = await prisma.lead.groupBy({
      by: ['bdId'],
      where: {
        ...baseWhere,
        pipelineStage: { in: ['SALES', 'INSURANCE'] },
      },
      _count: { id: true },
    })

    const bdFollowUps = await prisma.lead.groupBy({
      by: ['bdId'],
      where: {
        ...baseWhere,
        followUpDate: { not: null },
      },
      _count: { id: true },
    })

    const bdMap = new Map<string, { total: number; withFollowUp: number }>()
    bdCompliance.forEach((stat) => {
      bdMap.set(stat.bdId, { total: stat._count.id, withFollowUp: 0 })
    })
    bdFollowUps.forEach((stat) => {
      const existing = bdMap.get(stat.bdId) || { total: 0, withFollowUp: 0 }
      existing.withFollowUp = stat._count.id
      bdMap.set(stat.bdId, existing)
    })

    const bds = await prisma.user.findMany({
      where: {
        id: { in: Array.from(bdMap.keys()) },
        role: 'BD',
      },
      select: {
        id: true,
        name: true,
      },
    })

    const bdComplianceRates = Array.from(bdMap.entries())
      .map(([bdId, data]) => {
        const bd = bds.find((b) => b.id === bdId)
        const rate = data.total > 0 ? (data.withFollowUp / data.total) * 100 : 0
        return {
          bd: bd?.name || 'Unknown',
          rate: Math.round(rate * 100) / 100,
        }
      })
      .sort((a, b) => b.rate - a.rate)

    return successResponse({
      leadVelocity: {
        avgSalesToInsurance: Math.round(avgSalesToInsurance * 100) / 100,
        avgInsuranceToPL: Math.round(avgInsuranceToPL * 100) / 100,
        avgPLToCompleted: Math.round(avgPLToCompleted * 100) / 100,
        avgEndToEnd: Math.round(avgEndToEnd * 100) / 100,
      },
      followUpMetrics: {
        totalLeadsRequiringFollowUp: leadsRequiringFollowUp,
        leadsWithScheduledFollowUp: leadsWithScheduledFollowUp,
        overdueFollowUps,
        complianceRate: Math.round(complianceRate * 100) / 100,
        bdCompliance: bdComplianceRates,
      },
      dataQuality: {
        ...dataQuality,
        overallQualityScore: Math.round(completenessScore * 100) / 100,
      },
    })
  } catch (error) {
    console.error('Error fetching operational analytics:', error)
    return errorResponse('Failed to fetch operational analytics', 500)
  }
}
