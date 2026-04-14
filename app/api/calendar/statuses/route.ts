import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  zodErrorResponse,
} from '@/lib/api-utils'
import { z } from 'zod'

const createStatusSchema = z
  .object({
    kind: z.enum(['AVAILABLE', 'ONLINE_ONLY', 'UNAVAILABLE', 'CUSTOM']),
    label: z.string().max(120).optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: 'End must be after start',
    path: ['endsAt'],
  })
  .refine(
    (d) =>
      new Date(d.endsAt).getTime() - new Date(d.startsAt).getTime() <=
      30 * 24 * 60 * 60 * 1000,
    { message: 'Status cannot span more than 30 days', path: ['endsAt'] }
  )

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') ?? session.id

    const statuses = await prisma.userStatus.findMany({
      where: {
        userId,
        endsAt: { gte: new Date() },
      },
      orderBy: { startsAt: 'asc' },
    })
    return successResponse(statuses)
  } catch (error) {
    console.error('Error listing statuses:', error)
    return errorResponse('Failed to fetch statuses', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request)
    if (!session) return unauthorizedResponse()

    const body = await request.json()
    const parsed = createStatusSchema.safeParse(body)
    if (!parsed.success) return zodErrorResponse(parsed.error)

    const status = await prisma.userStatus.create({
      data: {
        userId: session.id,
        kind: parsed.data.kind,
        label: parsed.data.label?.trim() || null,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
      },
    })
    return successResponse(status, 'Status saved')
  } catch (error) {
    console.error('Error creating status:', error)
    return errorResponse('Failed to save status', 500)
  }
}
