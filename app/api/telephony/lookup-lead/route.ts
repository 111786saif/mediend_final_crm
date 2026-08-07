import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupPatientByPhone } from '@/lib/telephony-lead-lookup'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const rawPhone = searchParams.get('phone')?.trim()
    if (!rawPhone) {
      return errorResponse('Phone number is required', 400)
    }

    const result = await lookupPatientByPhone(rawPhone)
    return successResponse(result)
  } catch (error) {
    console.error('GET /api/telephony/lookup-lead error:', error)
    return errorResponse('Failed to lookup patient by phone number', 500)
  }
}
