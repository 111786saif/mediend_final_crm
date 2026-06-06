import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const hospitalName = searchParams.get('hospitalName')?.trim() || ''
    const doctorName = searchParams.get('doctorName')?.trim() || ''
    const bdId = searchParams.get('bdId')?.trim() || ''
    const circle = searchParams.get('circle')?.trim() || ''
    const treatment = searchParams.get('treatment')?.trim() || ''

    const leadWhere: Prisma.LeadWhereInput = {
      pipelineStage: { in: ['PL', 'COMPLETED'] },
      dischargeSheet: { isNot: null },
      plRecord: { isNot: null },
    }

    const leadAnd: Prisma.LeadWhereInput[] = []

    if (hospitalName) {
      leadAnd.push({
        OR: [
          { hospitalName: { contains: hospitalName, mode: 'insensitive' } },
          { dischargeSheet: { hospitalName: { contains: hospitalName, mode: 'insensitive' } } },
        ],
      })
    }

    if (doctorName) {
      leadAnd.push({
        OR: [
          { surgeonName: { contains: doctorName, mode: 'insensitive' } },
          { ipdDrName: { contains: doctorName, mode: 'insensitive' } },
          { dischargeSheet: { doctorName: { contains: doctorName, mode: 'insensitive' } } },
        ],
      })
    }

    if (bdId) leadWhere.bdId = bdId
    if (circle) leadAnd.push({ circle: { equals: circle, mode: 'insensitive' } })
    if (treatment) leadAnd.push({ treatment: { contains: treatment, mode: 'insensitive' } })

    if (leadAnd.length > 0) leadWhere.AND = leadAnd

    const leads = await prisma.lead.findMany({
      where: leadWhere,
      select: {
        id: true,
        hospitalName: true,
        surgeonName: true,
        ipdDrName: true,
        circle: true,
        treatment: true,
        bdId: true,
        bd: { select: { id: true, name: true } },
        dischargeSheet: {
          select: {
            doctorName: true,
            hospitalName: true,
          },
        },
        plRecord: {
          select: {
            hospitalPayoutStatus: true,
            doctorPayoutStatus: true,
            mediendInvoiceStatus: true,
            hospitalAmountPending: true,
            doctorAmountPending: true,
          },
        },
        outstandingCase: {
          select: {
            paymentReceived: true,
          },
        },
      },
    })

    let totalPendingAmount = 0
    let pendingCases = 0
    let fullyPaidCases = 0
    let paymentReceivedCases = 0

    const hospitalMap = new Map<string, { count: number; pendingAmount: number }>()
    const doctorMap = new Map<string, { count: number; pendingAmount: number }>()
    const bdMap = new Map<string, { name: string; count: number; pendingAmount: number }>()
    const circleMap = new Map<string, { count: number; pendingAmount: number }>()

    for (const l of leads) {
      const hospital = l.dischargeSheet?.hospitalName?.trim() || l.hospitalName?.trim() || 'Unknown'
      const doctor = l.dischargeSheet?.doctorName?.trim() || l.surgeonName?.trim() || l.ipdDrName?.trim() || 'Unknown'
      const bd = l.bd
      const circle = l.circle?.trim() || 'Unknown'

      const hospPending = l.plRecord?.hospitalAmountPending ?? 0
      const docPending = l.plRecord?.doctorAmountPending ?? 0
      const casePending = hospPending + docPending

      const isFullyPaid =
        l.plRecord?.hospitalPayoutStatus === 'PAID' &&
        l.plRecord?.doctorPayoutStatus === 'PAID' &&
        l.plRecord?.mediendInvoiceStatus === 'PAID'

      const isPending =
        l.plRecord?.hospitalPayoutStatus !== 'PAID' ||
        l.plRecord?.doctorPayoutStatus !== 'PAID' ||
        l.plRecord?.mediendInvoiceStatus !== 'PAID'

      totalPendingAmount += casePending
      if (isPending) pendingCases++
      if (isFullyPaid) fullyPaidCases++
      if (l.outstandingCase?.paymentReceived) paymentReceivedCases++

      const h = hospitalMap.get(hospital) || { count: 0, pendingAmount: 0 }
      h.count++
      h.pendingAmount += casePending
      hospitalMap.set(hospital, h)

      const d = doctorMap.get(doctor) || { count: 0, pendingAmount: 0 }
      d.count++
      d.pendingAmount += casePending
      doctorMap.set(doctor, d)

      if (bd) {
        const b = bdMap.get(bd.id) || { name: bd.name, count: 0, pendingAmount: 0 }
        b.count++
        b.pendingAmount += casePending
        bdMap.set(bd.id, b)
      }

      const c = circleMap.get(circle) || { count: 0, pendingAmount: 0 }
      c.count++
      c.pendingAmount += casePending
      circleMap.set(circle, c)
    }

    const sortByPendingAmount = (
      a: { pendingAmount: number },
      b: { pendingAmount: number },
    ) => b.pendingAmount - a.pendingAmount

    const hospitalLeaderboard = [...hospitalMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort(sortByPendingAmount)
      .slice(0, 10)

    const doctorLeaderboard = [...doctorMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort(sortByPendingAmount)
      .slice(0, 10)

    const bdLeaderboard = [...bdMap.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort(sortByPendingAmount)
      .slice(0, 10)

    const circleLeaderboard = [...circleMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort(sortByPendingAmount)

    return successResponse({
      totalCases: leads.length,
      totalPendingAmount,
      pendingCases,
      fullyPaidCases,
      paymentReceivedCases,
      averagePendingPerCase: pendingCases > 0 ? Math.round(totalPendingAmount / pendingCases) : 0,
      hospitalLeaderboard,
      doctorLeaderboard,
      bdLeaderboard,
      circleLeaderboard,
    })
  } catch (error) {
    console.error('Error fetching MD outstanding analytics:', error)
    return errorResponse('Failed to fetch outstanding analytics', 500)
  }
}
