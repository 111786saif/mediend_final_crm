import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

function canAccess(user: { role: string } | null): boolean {
  return user?.role === 'MD' || user?.role === 'ADMIN'
}

export async function GET(_request: NextRequest) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()
    if (!canAccess(user)) return errorResponse('Forbidden', 403)

    const rows = await prisma.leaveBalanceEditRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: {
            employeeCode: true,
            user: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    })

    // Custom sort: PENDING first, then by createdAt desc (Prisma enum order may not match)
    const statusOrder = { PENDING: 0, APPROVED: 1, REJECTED: 2 }
    rows.sort((a, b) => {
      const da = statusOrder[a.status as keyof typeof statusOrder]
      const db = statusOrder[b.status as keyof typeof statusOrder]
      if (da !== db) return da - db
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const data = rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.user.name,
      employeeCode: r.employee.employeeCode,
      department: r.employee.department?.name ?? null,
      requestedBy: { id: r.requestedBy.id, name: r.requestedBy.name, email: r.requestedBy.email },
      previous: { CL: r.prevCL, SL: r.prevSL, EL: r.prevEL },
      proposed: { CL: r.proposedCL, SL: r.proposedSL, EL: r.proposedEL },
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reviewedBy: r.reviewedBy ? { id: r.reviewedBy.id, name: r.reviewedBy.name } : null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewRemarks: r.reviewRemarks,
    }))

    return successResponse(data)
  } catch (e) {
    console.error('md leave-balance-edit-requests GET:', e)
    return errorResponse('Failed to load requests', 500)
  }
}
