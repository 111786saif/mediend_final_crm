import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSession } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapStatusCode } from '@/lib/mysql-code-mappings'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      console.log('MD Sales API: No user session found')
      return unauthorizedResponse()
    }

    console.log('MD Sales API: User role:', user.role, 'User ID:', user.id)

    // Only MD and ADMIN can access
    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      console.log('MD Sales API: Access denied for role:', user.role)
      return errorResponse(`Forbidden: Access denied for role ${user.role}. Only MD and ADMIN can access.`, 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // Base where clause for completed leads
    // Use conversionDate if available, otherwise use createdDate for date filtering
    // If no date filter, include all completed leads regardless of conversionDate
    const completedWhere: Prisma.LeadWhereInput = {
      pipelineStage: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { conversionDate: dateFilter },
              { 
                AND: [
                  { conversionDate: { equals: null } },
                  { leadDate: dateFilter }
                ]
              },
            ],
          }
        : {}),
    }

    // Base where clause for all leads (for conversion rate)
    const leadDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadDate: dateFilter },
              { AND: [{ leadDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}
    const allLeadsWhere: Prisma.LeadWhereInput = {
      ...leadDateFilter,
    }

    // Overall KPIs
    const [
      totalSurgeries,
      totalRevenue,
      totalProfit,
      avgTicketSize,
      avgNetProfit,
      totalLeads,
      statusDistribution,
    ] = await Promise.all([
      prisma.lead.count({ where: completedWhere }),
      prisma.lead.aggregate({
        where: completedWhere,
        _sum: { billAmount: true },
      }),
      prisma.lead.aggregate({
        where: completedWhere,
        _sum: { netProfit: true },
      }),
      prisma.lead.aggregate({
        where: completedWhere,
        _avg: { ticketSize: true },
      }),
      prisma.lead.aggregate({
        where: completedWhere,
        _avg: { netProfit: true },
      }),
      prisma.lead.count({ where: allLeadsWhere }),
      prisma.lead.groupBy({
        by: ['status'],
        where: allLeadsWhere,
        _count: { id: true },
      }),
    ])

    const conversionRate = totalLeads > 0 ? (totalSurgeries / totalLeads) * 100 : 0

    // Circle Performance
    const circleStats = await prisma.lead.groupBy({
      by: ['circle'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
        ticketSize: true,
      },
      _avg: {
        ticketSize: true,
      },
    })

    const circleLeads = await prisma.lead.groupBy({
      by: ['circle'],
      where: allLeadsWhere,
      _count: { id: true },
    })

    const circleMap = new Map(circleLeads.map((c) => [c.circle, c._count.id]))
    const circlePerformance = circleStats.map((circle) => {
      const totalCircleLeads = circleMap.get(circle.circle) || 0
      const circleSurgeries = circle._count.id
      return {
        circle: circle.circle,
        revenue: circle._sum.billAmount || 0,
        profit: circle._sum.netProfit || 0,
        surgeries: circleSurgeries,
        leads: totalCircleLeads,
        conversionRate: totalCircleLeads > 0 ? (circleSurgeries / totalCircleLeads) * 100 : 0,
        avgTicketSize: circle._avg.ticketSize || 0,
      }
    })
    circlePerformance.sort((a, b) => b.revenue - a.revenue)

    // Disease/Treatment Performance
    const treatmentStats = await prisma.lead.groupBy({
      by: ['treatment'],
      where: {
        ...completedWhere,
        treatment: { not: null },
      },
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const diseaseStats = await prisma.lead.groupBy({
      by: ['diseaseDetails'],
      where: {
        ...completedWhere,
        diseaseDetails: { not: null },
      },
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const diseasePerformance = [
      ...treatmentStats
        .filter((t) => t.treatment)
        .map((t) => ({
          disease: t.treatment || 'Unknown',
          count: t._count.id,
          revenue: t._sum.billAmount || 0,
          profit: t._sum.netProfit || 0,
        })),
      ...diseaseStats
        .filter((d) => d.diseaseDetails)
        .map((d) => ({
          disease: d.diseaseDetails || 'Unknown',
          count: d._count.id,
          revenue: d._sum.billAmount || 0,
          profit: d._sum.netProfit || 0,
        })),
    ]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)

    // Hospital Performance
    const hospitalStats = await prisma.lead.groupBy({
      by: ['hospitalName'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const hospitalPerformance = hospitalStats
      .map((h) => ({
        hospital: h.hospitalName,
        surgeries: h._count.id,
        revenue: h._sum.billAmount || 0,
        profit: h._sum.netProfit || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)

    // Cross-Analysis: Disease by Circle
    const diseaseByCircle = await prisma.lead.groupBy({
      by: ['circle', 'treatment'],
      where: {
        ...completedWhere,
        treatment: { not: null },
      },
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const diseaseByCircleMap = new Map<string, Array<{ disease: string; count: number; revenue: number; profit: number }>>()
    diseaseByCircle.forEach((item) => {
      const key = item.circle
      if (!diseaseByCircleMap.has(key)) {
        diseaseByCircleMap.set(key, [])
      }
      diseaseByCircleMap.get(key)!.push({
        disease: item.treatment || 'Unknown',
        count: item._count.id,
        revenue: item._sum.billAmount || 0,
        profit: item._sum.netProfit || 0,
      })
    })

    const diseaseByCircleData = Array.from(diseaseByCircleMap.entries()).map(([circle, diseases]) => ({
      circle,
      diseases: diseases.sort((a, b) => b.revenue - a.revenue),
    }))

    // Cross-Analysis: Hospital by Circle
    const hospitalByCircle = await prisma.lead.groupBy({
      by: ['circle', 'hospitalName'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const hospitalByCircleMap = new Map<string, Array<{ hospital: string; surgeries: number; revenue: number; profit: number }>>()
    hospitalByCircle.forEach((item) => {
      const key = item.circle
      if (!hospitalByCircleMap.has(key)) {
        hospitalByCircleMap.set(key, [])
      }
      hospitalByCircleMap.get(key)!.push({
        hospital: item.hospitalName,
        surgeries: item._count.id,
        revenue: item._sum.billAmount || 0,
        profit: item._sum.netProfit || 0,
      })
    })

    const hospitalByCircleData = Array.from(hospitalByCircleMap.entries()).map(([circle, hospitals]) => ({
      circle,
      hospitals: hospitals.sort((a, b) => b.revenue - a.revenue),
    }))

    // Cross-Analysis: Disease by Hospital
    const diseaseByHospital = await prisma.lead.groupBy({
      by: ['hospitalName', 'treatment'],
      where: {
        ...completedWhere,
        treatment: { not: null },
      },
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const diseaseByHospitalMap = new Map<string, Array<{ disease: string; count: number; revenue: number; profit: number }>>()
    diseaseByHospital.forEach((item) => {
      const key = item.hospitalName
      if (!diseaseByHospitalMap.has(key)) {
        diseaseByHospitalMap.set(key, [])
      }
      diseaseByHospitalMap.get(key)!.push({
        disease: item.treatment || 'Unknown',
        count: item._count.id,
        revenue: item._sum.billAmount || 0,
        profit: item._sum.netProfit || 0,
      })
    })

    const diseaseByHospitalData = Array.from(diseaseByHospitalMap.entries()).map(([hospital, diseases]) => ({
      hospital,
      diseases: diseases.sort((a, b) => b.revenue - a.revenue),
    }))

    // Payment Mode Analysis
    const paymentModeStats = await prisma.lead.groupBy({
      by: ['modeOfPayment'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const paymentModeAnalysis = paymentModeStats.map((p) => ({
      mode: p.modeOfPayment || 'Unknown',
      count: p._count.id,
      revenue: p._sum.billAmount || 0,
      profit: p._sum.netProfit || 0,
    }))

    // Revenue/Profit Trends (Daily)
    // Get all completed leads and group by date (use conversionDate or createdDate)
    const completedLeadsForTrends = await prisma.lead.findMany({
      where: completedWhere,
      select: {
        conversionDate: true,
        leadDate: true,
        createdDate: true,
        billAmount: true,
        netProfit: true,
      },
    })

    // Group by date
    const trendsMap = new Map<string, { revenue: number; profit: number; surgeries: number }>()
    completedLeadsForTrends.forEach((lead) => {
      const dateKey = (lead.conversionDate || lead.leadDate || lead.createdDate).toISOString().split('T')[0]
      const existing = trendsMap.get(dateKey) || { revenue: 0, profit: 0, surgeries: 0 }
      existing.revenue += lead.billAmount || 0
      existing.profit += lead.netProfit || 0
      existing.surgeries += 1
      trendsMap.set(dateKey, existing)
    })

    const revenueProfitTrends = Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        profit: data.profit,
        surgeries: data.surgeries,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // BD Performance
    const bdStats = await prisma.lead.groupBy({
      by: ['bdId'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const bdLeads = await prisma.lead.groupBy({
      by: ['bdId'],
      where: allLeadsWhere,
      _count: { id: true },
    })

    const bdMap = new Map(bdLeads.map((b) => [b.bdId, b._count.id]))
    const bdIds = [...new Set(bdStats.map((b) => b.bdId))]
    const bds = await prisma.user.findMany({
      where: { id: { in: bdIds }, role: 'BD' },
      include: {
        employee: {
          select: {
            team: { select: { id: true, name: true } },
          },
        },
      },
    })

    const bdPerformance = bdStats.map((stat) => {
      const bd = bds.find((b) => b.id === stat.bdId)
      const totalBdLeads = bdMap.get(stat.bdId) || 0
      const closedLeads = stat._count.id
      return {
        bdId: stat.bdId,
        bdName: bd?.name || 'Unknown',
        teamName: bd?.employee?.team?.name || 'No Team',
        revenue: stat._sum.billAmount || 0,
        profit: stat._sum.netProfit || 0,
        closedLeads,
        totalLeads: totalBdLeads,
        conversionRate: totalBdLeads > 0 ? (closedLeads / totalBdLeads) * 100 : 0,
      }
    })
    bdPerformance.sort((a, b) => b.profit - a.profit)

    // Team Performance
    const teamMap = new Map<string, { name: string; revenue: number; profit: number; closedLeads: number; totalLeads: number }>()
    bdPerformance.forEach((bd) => {
      const bdUser = bds.find((b) => b.id === bd.bdId)
      const deptTeam = bdUser?.employee?.team
      if (deptTeam) {
        const existing = teamMap.get(deptTeam.id) || {
          name: deptTeam.name,
          revenue: 0,
          profit: 0,
          closedLeads: 0,
          totalLeads: 0,
        }
        existing.revenue += bd.revenue
        existing.profit += bd.profit
        existing.closedLeads += bd.closedLeads
        existing.totalLeads += bd.totalLeads
        teamMap.set(deptTeam.id, existing)
      }
    })

    const teamPerformance = Array.from(teamMap.values())
      .map((team) => ({
        teamName: team.name,
        revenue: team.revenue,
        profit: team.profit,
        closedLeads: team.closedLeads,
        totalLeads: team.totalLeads,
        conversionRate: team.totalLeads > 0 ? (team.closedLeads / team.totalLeads) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit)

    // Conversion Funnel
    // Map statuses before filtering
    const mappedStatusDistribution = statusDistribution.map((s) => ({
      status: mapStatusCode(s.status),
      count: s._count.id,
    }))
    
    const funnelData = {
      totalLeads,
      followUps: mappedStatusDistribution
        .filter((s) => {
          const statusLower = s.status.toLowerCase()
          return statusLower.includes('follow') || 
                 statusLower.includes('call back') ||
                 statusLower.includes('follow-up')
        })
        .reduce((sum, s) => sum + s.count, 0),
      ipdDone: mappedStatusDistribution
        .filter((s) => s.status.toLowerCase().includes('ipd done'))
        .reduce((sum, s) => sum + s.count, 0),
      completed: totalSurgeries,
    }

    const response = {
      kpis: {
        totalRevenue: totalRevenue._sum.billAmount || 0,
        totalProfit: totalProfit._sum.netProfit || 0,
        totalLeads,
        completedSurgeries: totalSurgeries,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgTicketSize: avgTicketSize._avg.ticketSize || 0,
        avgNetProfitPerSurgery: avgNetProfit._avg.netProfit || 0,
      },
      circlePerformance: circlePerformance.slice(0, 20),
      diseasePerformance,
      hospitalPerformance,
      crossAnalysis: {
        diseaseByCircle: diseaseByCircleData,
        hospitalByCircle: hospitalByCircleData,
        diseaseByHospital: diseaseByHospitalData,
      },
      paymentModeAnalysis,
      revenueProfitTrends,
      bdPerformance: bdPerformance.slice(0, 50),
      teamPerformance,
      statusDistribution: mappedStatusDistribution,
      conversionFunnel: funnelData,
    }

    console.log('MD Sales Analytics Response:', {
      totalSurgeries,
      totalLeads,
      circleCount: circlePerformance.length,
      revenueTrendsCount: revenueProfitTrends.length,
      paymentModeCount: paymentModeAnalysis.length,
    })

    return successResponse(response)
  } catch (error) {
    console.error('Error fetching MD sales analytics:', error)
    return errorResponse('Failed to fetch sales analytics', 500)
  }
}
