import { NextRequest } from 'next/server'
import { z } from 'zod'
import { DoctorPayoffRequestStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  doctorPayoffInclude,
  logDoctorPayoffActivity,
  mapDoctorPayoffRequest,
} from '@/lib/finance/doctor-payoff/mapper'

const rejectSchema = z.object({
  rejectionRemarks: z.string().min(1).max(5000),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ?? 'Rejection remark is required',
        400
      )
    }

    const existing = await prisma.doctorPayoffRequest.findUnique({ where: { id } })
    if (!existing) return errorResponse('Doctor payoff request not found', 404)
    if (existing.status !== DoctorPayoffRequestStatus.PENDING) {
      return errorResponse('Only pending requests can be rejected', 400)
    }

    const rejectionRemarks = parsed.data.rejectionRemarks.trim()

    const updated = await prisma.doctorPayoffRequest.update({
      where: { id },
      data: {
        status: DoctorPayoffRequestStatus.REJECTED,
        rejectionRemarks,
        financeRemarks: null,
        verificationDocUrl: null,
        verificationDocName: null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: doctorPayoffInclude,
    })

    await logDoctorPayoffActivity(prisma, {
      requestId: id,
      action: 'REJECTED',
      message: `Doctor payoff request rejected for ${updated.doctorName}`,
      remarks: rejectionRemarks,
      actorId: user.id,
    })

    return successResponse(mapDoctorPayoffRequest(updated), 'Doctor payoff request rejected')
  } catch (error) {
    console.error('Error rejecting doctor payoff request:', error)
    return errorResponse('Failed to reject doctor payoff request', 500)
  }
}
