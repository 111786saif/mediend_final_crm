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

const approveSchema = z.object({
  verificationDocUrl: z.string().min(1),
  verificationDocName: z.string().max(500).optional().nullable(),
  financeRemarks: z.string().max(5000).optional().nullable(),
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
    const body = await request.json().catch(() => ({}))
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ?? 'Verification document is required to approve',
        400
      )
    }

    const existing = await prisma.doctorPayoffRequest.findUnique({ where: { id } })
    if (!existing) return errorResponse('Doctor payoff request not found', 404)
    if (existing.status !== DoctorPayoffRequestStatus.PENDING) {
      return errorResponse('Only pending requests can be approved', 400)
    }

    const financeRemarks = parsed.data.financeRemarks?.trim() || null

    const updated = await prisma.doctorPayoffRequest.update({
      where: { id },
      data: {
        status: DoctorPayoffRequestStatus.APPROVED,
        verificationDocUrl: parsed.data.verificationDocUrl,
        verificationDocName: parsed.data.verificationDocName?.trim() || null,
        financeRemarks,
        rejectionRemarks: null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: doctorPayoffInclude,
    })

    await logDoctorPayoffActivity(prisma, {
      requestId: id,
      action: 'APPROVED',
      message: `Doctor payoff request approved for ${updated.doctorName} with verification document`,
      remarks: financeRemarks,
      actorId: user.id,
    })

    return successResponse(mapDoctorPayoffRequest(updated), 'Doctor payoff request approved')
  } catch (error) {
    console.error('Error approving doctor payoff request:', error)
    return errorResponse('Failed to approve doctor payoff request', 500)
  }
}
