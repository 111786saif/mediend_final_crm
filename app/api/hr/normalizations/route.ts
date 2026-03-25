import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }
    if (!hasPermission(user, 'hrms:attendance:read') && !hasPermission(user, 'hrms:attendance:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: {
      type: { in: ['MANAGER', 'EMPLOYEE_REQUEST'] }
      status?: 'PENDING' | 'APPROVED' | 'REJECTED'
      managerApprovedAt?: { not: null } | null
      date?: { gte?: Date; lte?: Date }
    } = {
      type: { in: ['MANAGER', 'EMPLOYEE_REQUEST'] },
    }

    if (status) {
      where.status = status
    }

    if (status === 'PENDING') {
      where.managerApprovedAt = { not: null }
    }

    if (fromDate || toDate) {
      where.date = {}
      if (fromDate) {
        const [y, m, d] = fromDate.split('-').map(Number)
        where.date.gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
      }
      if (toDate) {
        const [y, m, d] = toDate.split('-').map(Number)
        where.date.lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      }
    }

    const list = await prisma.attendanceNormalization.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            user: { select: { name: true, email: true } },
          },
        },
        requestedBy: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        managerApprovedBy: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        approvedBy: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    return successResponse({
      list: list.map((n) => {
        // Employee-initiated requests: after manager approval, HR cares who approved on behalf of the team.
        const useManagerAsRequester =
          n.type === 'EMPLOYEE_REQUEST' && n.managerApprovedBy != null
        const requestedByName = useManagerAsRequester
          ? n.managerApprovedBy!.user.name
          : (n.requestedBy?.user?.name ?? null)
        const requestedByEmail = useManagerAsRequester
          ? n.managerApprovedBy!.user.email
          : (n.requestedBy?.user?.email ?? null)

        return {
          id: n.id,
          employeeId: n.employeeId,
          employeeName: n.employee.user.name,
          employeeCode: n.employee.employeeCode,
          employeeEmail: n.employee.user.email,
          date: n.date.toISOString().split('T')[0],
          type: n.type,
          status: n.status,
          reason: n.reason,
          normalizeAs: n.normalizeAs ?? null,
          createdAt: n.createdAt.toISOString(),
          requestedBy: requestedByName,
          requestedByEmail,
          /** Employee who submitted (differs from requestedBy after manager approval for EMPLOYEE_REQUEST) */
          submittedByEmployeeName: n.requestedBy?.user?.name ?? null,
          submittedByEmployeeEmail: n.requestedBy?.user?.email ?? null,
          approvedBy: n.approvedBy?.user?.name ?? null,
        }
      }),
    })
  } catch (error) {
    console.error('Error fetching HR normalizations:', error)
    return errorResponse('Failed to fetch normalizations', 500)
  }
}
