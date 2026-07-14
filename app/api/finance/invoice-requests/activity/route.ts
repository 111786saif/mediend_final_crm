import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import type { RequestActivityItem } from '@/lib/finance/doctor-payoff/types'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPlOrFinanceRead(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const hospitalName = searchParams.get('hospitalName')?.trim()
    const requestId = searchParams.get('requestId')?.trim()
    const take = Math.min(Number(searchParams.get('limit') || 30), 100)

    const rows = await prisma.invoiceRequestActivity.findMany({
      where: {
        ...(requestId ? { requestId } : {}),
        ...(hospitalName
          ? { request: { lead: { hospitalName } } }
          : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        request: {
          select: {
            id: true,
            invoiceAmount: true,
            status: true,
            lead: { select: { hospitalName: true, leadRef: true, patientName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    })

    const items: RequestActivityItem[] = rows.map((row) => ({
      id: row.id,
      requestId: row.requestId,
      action: row.action,
      message: row.message,
      remarks: row.remarks,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor,
      meta: {
        hospitalName: row.request.lead.hospitalName,
        amount: row.request.invoiceAmount,
        status: row.request.status,
      },
    }))

    return successResponse({ items })
  } catch (error) {
    console.error('Error fetching invoice request activity:', error)
    return errorResponse('Failed to fetch activity log', 500)
  }
}
