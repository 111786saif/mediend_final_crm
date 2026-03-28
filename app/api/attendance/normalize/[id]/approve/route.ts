import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { isUserInMDManagedCohort } from '@/lib/hierarchy'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const bodySchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    remarks: z.string().optional(),
    normalizeAs: z.enum(['FULL_DAY', 'HALF_DAY']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'REJECTED') {
      const r = (data.remarks ?? '').trim()
      if (r.length < 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Rejection reason must be at least 15 characters',
          path: ['remarks'],
        })
      }
    }
  })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:attendance:write') && !hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const parsed = bodySchema.parse(body)
    const { status, normalizeAs: normalizeAsBody } = parsed
    const rejectionRemarks =
      status === 'REJECTED' ? (parsed.remarks ?? '').trim() : null

    const normalization = await prisma.attendanceNormalization.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            userId: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    })

    if (!normalization) {
      return errorResponse('Normalization request not found', 404)
    }

    if (normalization.status !== 'PENDING') {
      return errorResponse('This request is not pending', 400)
    }

    if (normalization.type !== 'MANAGER' && normalization.type !== 'EMPLOYEE_REQUEST') {
      return errorResponse('Only manager-initiated or employee-request normalizations can be approved by HR', 400)
    }

    const hrEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!hrEmployee) {
      return errorResponse('Employee record not found for approver', 404)
    }

    if (hrEmployee.id === normalization.employee.id) {
      return errorResponse('You cannot approve your own normalization request', 403)
    }

    if (await isUserInMDManagedCohort(normalization.employee.userId)) {
      return errorResponse(
        'This normalization is for the MD-managed team; approve it from MD Attendance.',
        403
      )
    }

    const resolvedNormalizeAs =
      status === 'APPROVED'
        ? normalizeAsBody ?? normalization.normalizeAs ?? 'FULL_DAY'
        : null

    const updated = await prisma.attendanceNormalization.update({
      where: { id },
      data: {
        status,
        approvedById: status === 'APPROVED' ? hrEmployee.id : null,
        hrRejectionReason: status === 'REJECTED' ? rejectionRemarks : null,
        normalizeAs: resolvedNormalizeAs,
      },
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
            user: { select: { name: true } },
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

    return successResponse(
      updated,
      status === 'APPROVED' ? 'Normalization approved' : 'Normalization rejected'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues[0]?.message ?? 'Invalid request data'
      return errorResponse(msg, 400)
    }
    console.error('Error approving normalization:', error)
    return errorResponse('Failed to update normalization', 500)
  }
}
