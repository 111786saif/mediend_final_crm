import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ComplianceCallStatus } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const updateSchema = z.object({
  status: z.nativeEnum(ComplianceCallStatus).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  callbackAt: z.string().datetime().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const existing = await prisma.complianceCall.findUnique({ where: { id } })
    if (!existing) return errorResponse('Compliance call not found', 404)

    const data: Parameters<typeof prisma.complianceCall.update>[0]['data'] = {
      calledByUserId: user.id,
    }

    const now = new Date()
    let statusChanged = false

    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status
      statusChanged = parsed.data.status !== existing.status

      if (parsed.data.status === ComplianceCallStatus.COMPLETED) {
        if (parsed.data.rating == null && existing.rating == null) {
          return errorResponse('Rating is required to mark a call completed', 400)
        }
        data.completedAt = existing.completedAt ?? now
      }
      if (parsed.data.status === ComplianceCallStatus.CALLBACK_SCHEDULED) {
        if (!parsed.data.callbackAt && !existing.callbackAt) {
          return errorResponse('callbackAt is required for CALLBACK_SCHEDULED', 400)
        }
      }
    }

    if (parsed.data.rating !== undefined) data.rating = parsed.data.rating
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes
    if (parsed.data.callbackAt !== undefined) {
      data.callbackAt = parsed.data.callbackAt ? new Date(parsed.data.callbackAt) : null
    }

    if (statusChanged) data.lastAttemptedAt = now

    const updated = await prisma.complianceCall.update({
      where: { id },
      data,
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
            treatment: true,
            hospitalName: true,
            bd: { select: { id: true, name: true } },
          },
        },
        calledBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('Error updating compliance call:', error)
    return errorResponse('Failed to update compliance call', 500)
  }
}
