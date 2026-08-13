import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePlOrFinanceRead } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import type { RequestActivityItem } from '@/lib/finance/doctor-payoff/types'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectivePlOrFinanceRead(user))) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const doctorName = searchParams.get('doctorName')?.trim()
    const requestId = searchParams.get('requestId')?.trim()
    const take = Math.min(Number(searchParams.get('limit') || 30), 100)

    const rows = await prisma.doctorPayoffRequestActivity.findMany({
      where: {
        ...(requestId ? { requestId } : {}),
        ...(doctorName ? { request: { doctorName } } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        request: {
          select: {
            id: true,
            doctorName: true,
            hospitalName: true,
            requestAmount: true,
            status: true,
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
        doctorName: row.request.doctorName,
        hospitalName: row.request.hospitalName,
        amount: row.request.requestAmount,
        status: row.request.status,
      },
    }))

    return successResponse({ items })
  } catch (error) {
    console.error('Error fetching doctor payoff activity:', error)
    return errorResponse('Failed to fetch activity log', 500)
  }
}
