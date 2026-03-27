import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { addMinutes } from 'date-fns'
import { meetWithRelationsInclude, userMeetAccessWhere } from '@/lib/meets'

/**
 * Meets starting within the next `minutes` (default 10), for non-blocking reminders.
 * Window: now < scheduledAt <= now + minutes
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const minutes = Math.min(120, Math.max(1, parseInt(searchParams.get('minutes') || '10', 10) || 10))

    const now = new Date()
    const until = addMinutes(now, minutes)

    const meets = await prisma.meet.findMany({
      where: {
        AND: [
          userMeetAccessWhere(user.id),
          { scheduledAt: { gt: now, lte: until } },
        ],
      },
      include: meetWithRelationsInclude,
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    })

    return successResponse(meets)
  } catch (error) {
    console.error('Error fetching upcoming meets:', error)
    return errorResponse('Failed to fetch upcoming meets', 500)
  }
}
