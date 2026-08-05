import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { fetchKnowlarityRegistrations, normalizeKnowlarityPhone } from '@/lib/knowlarity'
import { hasPermission } from '@/lib/rbac'
import { getSessionFromRequest } from '@/lib/session'

function ensureExecutiveAssistant(user: ReturnType<typeof getSessionFromRequest>) {
  if (!user) {
    return unauthorizedResponse()
  }

  if (user.role !== 'EXECUTIVE_ASSISTANT') {
    return errorResponse('Only Executive Assistant users can view Knowlarity registrations.', 403)
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    const eaGuard = ensureExecutiveAssistant(user)
    if (eaGuard) return eaGuard

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const currentNumber = request.nextUrl.searchParams.get('phoneNumber')?.trim() || null
    const registrations = await fetchKnowlarityRegistrations()
    const normalizedCurrentNumber = currentNumber ? normalizeKnowlarityPhone(currentNumber) : null

    return successResponse({
      registrations: registrations.registrations,
      total: registrations.registrations.length,
      currentNumber,
      normalizedCurrentNumber,
      currentNumberRegistered: normalizedCurrentNumber
        ? registrations.normalizedRegistrations.includes(normalizedCurrentNumber)
        : false,
    })
  } catch (error) {
    console.error('Error fetching Knowlarity registrations:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch Knowlarity registrations',
      500
    )
  }
}
