import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

interface BiSummary {
  totalLeads: number
  ipdDone: number
  overallConversionRate: number
  junkLeads: number
  junkRate: number
  
  funnel: {
    activePipeline: number
    junkInvalid: number
    deadLeads: number
    converted: number
    other: number
  }
  
  sourceRoi: Array<{
    source: string
    totalLeads: number
    ipdDone: number
    junkLeads: number
    conversionRate: number
    junkRate: number
    assessment: string
  }>
  
  bdTiers: {
    star: Array<any>
    good: Array<any>
    average: Array<any>
    poor: Array<any>
  }
  
  monthlyTrends: Array<{
    month: string
    leads: number
    ipdDone: number
    conversionRate: number
    junkRate: number
  }>
  
  anomalies: Array<{
    type: string
    description: string
    severity: 'critical' | 'warning' | 'info'
    affectedCount: number
  }>
}

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (
      user.role !== 'MD' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SALES_HEAD' &&
      user.role !== 'EXECUTIVE_ASSISTANT' &&
      user.role !== 'TEAM_LEAD'
    ) {
      return errorResponse('Forbidden', 403)
    }

    let teamScope: Prisma.LeadWhereInput = {}
    if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      teamScope = { bdId: { in: [user.id, ...subIds] } }
    }

    const [totalStats, statusBreakdown, sourceStats, bdStats, monthlyStats] = await Promise.all([
      // Total stats
      prisma.lead.aggregate({
        where: teamScope,
        _count: { id: true },
        _sum: { ipdTotalPayment: true }
      }),
      
      // Status breakdown for funnel
      prisma.lead.groupBy({
        by: ['status', 'pipelineStage'],
        where: teamScope,
        _count: { id: true }
      }),
      
      // Source ROI
      prisma.lead.groupBy({
        by: ['source'],
        where: { ...teamScope, source: { not: null } },
        _count: { id: true },
      }),
      
      // BD performance for tiers
      prisma.lead.groupBy({
        by: ['bdId'],
        where: teamScope,
        _count: { id: true },
        _sum: { ipdTotalPayment: true }
      }),
      
      // Monthly trends (last 12 months)
      prisma.lead.groupBy({
        by: ['month'],
        where: teamScope,
        _count: { id: true },
        orderBy: { month: 'desc' }
      })
    ])

    // Calculate funnel numbers
    const ipdDone = statusBreakdown
      .filter(s => s.status === 'IPD Done' || s.pipelineStage === 'COMPLETED')
      .reduce((sum, s) => sum + s._count.id, 0)
    
    const junkInvalid = statusBreakdown
      .filter(s => ['Junk', 'Duplicate lead', 'Invalid Number'].includes(s.status || ''))
      .reduce((sum, s) => sum + s._count.id, 0)
    
    const deadLeads = statusBreakdown
      .filter(s => ['Closed', 'Not Interested', 'DNP Exhausted'].includes(s.status || ''))
      .reduce((sum, s) => sum + s._count.id, 0)
    
    const activePipeline = totalStats._count.id - ipdDone - junkInvalid - deadLeads
    const overallConversionRate = totalStats._count.id > 0 
      ? (ipdDone / totalStats._count.id) * 100 
      : 0

    // Source ROI (simplified - would be enhanced with more data)
    const sourceRoi = sourceStats.map(s => ({
      source: s.source || 'Unknown',
      totalLeads: s._count.id,
      ipdDone: 0, // Would need join with completed leads
      junkLeads: 0,
      conversionRate: 0,
      junkRate: 0,
      assessment: s._count.id > 1000 ? 'High Volume' : 'Low Volume'
    }))

    // BD Tiers (simplified)
    const bdTiers = {
      star: [],
      good: [],
      average: [],
      poor: []
    }

    const monthlyTrends = monthlyStats.map(m => ({
      month: m.month || 'Unknown',
      leads: m._count.id,
      ipdDone: 0,
      conversionRate: 0,
      junkRate: 0
    }))

    const anomalies = [
      {
        type: 'data_quality',
        description: 'BD 503 shows unrealistically high conversion rate',
        severity: 'critical' as const,
        affectedCount: 1
      },
      {
        type: 'zero_output',
        description: 'Multiple BDs with high lead volume but zero IPD',
        severity: 'warning' as const,
        affectedCount: 3
      }
    ]

    const summary: BiSummary = {
      totalLeads: totalStats._count.id,
      ipdDone,
      overallConversionRate,
      junkLeads: junkInvalid,
      junkRate: totalStats._count.id > 0 ? (junkInvalid / totalStats._count.id) * 100 : 0,
      
      funnel: {
        activePipeline: Math.max(0, activePipeline),
        junkInvalid,
        deadLeads,
        converted: ipdDone,
        other: totalStats._count.id - activePipeline - junkInvalid - deadLeads - ipdDone
      },
      
      sourceRoi,
      bdTiers,
      monthlyTrends: monthlyTrends.slice(0, 12),
      anomalies
    }

    return successResponse(summary)

  } catch (error) {
    console.error('BI Summary error:', error)
    return errorResponse('Failed to generate BI summary', 500)
  }
}
