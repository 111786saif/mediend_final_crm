import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mdPendingNormalizationsWhere } from '@/lib/hrms/normalization-md-pending'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }
    if (user.role !== 'MD') {
      return errorResponse('Forbidden', 403)
    }

    const mdEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })
    if (!mdEmployee) {
      return errorResponse('Employee record not found', 404)
    }

    const list = await prisma.attendanceNormalization.findMany({
      where: mdPendingNormalizationsWhere(mdEmployee.id),
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { name: true, email: true } },
          },
        },
        requestedBy: { select: { user: { select: { name: true, email: true } } } },
        managerApprovedBy: { select: { user: { select: { name: true } } } },
      },
    })

    const formatted = list.map((n) => ({
      id: n.id,
      employeeId: n.employeeId,
      employeeName: n.employee.user.name,
      employeeCode: n.employee.employeeCode,
      employeeEmail: n.employee.user.email,
      date: n.date.toISOString().split('T')[0],
      type: n.type,
      reason: n.reason,
      normalizeAs: n.normalizeAs ?? null,
      managerApprovedAt: n.managerApprovedAt ? n.managerApprovedAt.toISOString() : null,
      requestedByName: n.requestedBy?.user?.name ?? null,
      managerApprovedByName: n.managerApprovedBy?.user?.name ?? null,
    }))

    return successResponse({ list: formatted })
  } catch (error) {
    console.error('Error fetching MD normalizations:', error)
    return errorResponse('Failed to fetch normalizations', 500)
  }
}
