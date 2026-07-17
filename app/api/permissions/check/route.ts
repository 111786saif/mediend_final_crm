import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasFeaturePermission } from '@/lib/permissions'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasEffectiveCrmPermission, isCrmPermissionKey } from '@/lib/crm-permissions'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const feature = searchParams.get('feature')
    if (!feature) {
      return errorResponse('Missing feature query param', 400)
    }

    const allowed = isCrmPermissionKey(feature)
      ? await hasEffectiveCrmPermission(user.id, feature)
      : await hasFeaturePermission(user.id, feature)
    return successResponse({ allowed })
  } catch (error) {
    console.error('Error checking permission:', error)
    return errorResponse('Failed to check permission', 500)
  }
}
