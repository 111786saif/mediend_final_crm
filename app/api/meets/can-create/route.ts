import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canUserCreateMeet } from '@/lib/hierarchy'

export async function GET(_request: NextRequest) {
  const user = getSessionFromRequest(_request)
  if (!user) return unauthorizedResponse()
  const canCreate = await canUserCreateMeet(user)
  return successResponse({ canCreate })
}
