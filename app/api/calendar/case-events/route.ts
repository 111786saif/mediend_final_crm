import { NextRequest } from 'next/server'
import { getSessionWithFreshUser } from '@/lib/session'
import { getCaseCalendarEvents, type CaseEventStatus, type CaseEventType } from '@/lib/case-calendar-events'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const ALL_TYPES: CaseEventType[] = ['IPD', 'OPD']
const ALL_STATUSES: CaseEventStatus[] = ['DONE', 'SCHEDULED', 'POSTPONED', 'CANCELLED']

function parseList<T extends string>(raw: string | null, allowed: T[]): T[] {
  if (!raw) return allowed
  const picked = raw
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter((v): v is T => (allowed as string[]).includes(v))
  return picked.length > 0 ? picked : allowed
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    const sp = request.nextUrl.searchParams
    const startDateRaw = sp.get('startDate')
    const endDateRaw = sp.get('endDate')
    if (!startDateRaw || !endDateRaw) {
      return errorResponse('startDate and endDate are required', 400)
    }
    const startDate = new Date(`${startDateRaw}T00:00:00.000Z`)
    const endDate = new Date(`${endDateRaw}T23:59:59.999Z`)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return errorResponse('Invalid startDate/endDate', 400)
    }

    const types = parseList(sp.get('type'), ALL_TYPES)
    const statuses = parseList(sp.get('status'), ALL_STATUSES)
    const bdIdRaw = sp.get('bdId')
    const bdIds = bdIdRaw ? bdIdRaw.split(',').map((v) => v.trim()).filter(Boolean) : undefined

    const events = await getCaseCalendarEvents(user, { startDate, endDate, types, statuses, bdIds })
    return successResponse(events)
  } catch (error) {
    console.error('Error fetching IPD/OPD calendar events:', error)
    return errorResponse('Failed to fetch calendar events', 500)
  }
}