import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { userMeetAccessWhere } from '@/lib/meets'

const patchSchema = z
  .object({
    attended: z.boolean().optional(),
    remarks: z.string().max(2000).optional().nullable(),
  })
  .refine((d) => d.attended !== undefined || d.remarks !== undefined, {
    message: 'Provide attendance and/or remarks',
  })

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { id: meetId } = await ctx.params
    const body = await request.json()
    const data = patchSchema.parse(body)

    const meet = await prisma.meet.findFirst({
      where: { id: meetId, AND: [userMeetAccessWhere(user.id)] },
      select: { id: true },
    })
    if (!meet) {
      return errorResponse('Meet not found', 404)
    }

    const remarks =
      data.remarks === undefined ? undefined : data.remarks?.trim() ? data.remarks.trim() : null

    const row = await prisma.meetParticipant.upsert({
      where: { meetId_userId: { meetId, userId: user.id } },
      create: {
        meetId,
        userId: user.id,
        attended: data.attended ?? null,
        remarks: remarks !== undefined ? remarks : null,
      },
      update: {
        ...(data.attended !== undefined ? { attended: data.attended } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
      },
      select: { id: true, attended: true, remarks: true },
    })

    return successResponse(row, 'Saved')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0]?.message || 'Invalid input', 400)
    }
    console.error('meet my-attendance PATCH:', error)
    return errorResponse('Failed to save attendance', 500)
  }
}
