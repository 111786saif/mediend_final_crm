import { NextRequest } from 'next/server'
import { addMinutes } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * Assigned leads whose follow-up is about to start. This deliberately returns
 * only the current user's leads: the reminder is a prompt for the person who
 * needs to make the call, not a new team-wide notification feed.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const now = new Date()
    const until = addMinutes(now, 5)
    const leads = await prisma.lead.findMany({
      where: {
        bdId: user.id,
        removeFollowUpDate: false,
        followUpDate: { gt: now, lte: until },
      },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        followUpDate: true,
      },
      orderBy: { followUpDate: 'asc' },
      take: 20,
    })

    return successResponse(leads)
  } catch (error) {
    console.error('Error fetching follow-up reminders:', error)
    return errorResponse('Failed to fetch follow-up reminders', 500)
  }
}
