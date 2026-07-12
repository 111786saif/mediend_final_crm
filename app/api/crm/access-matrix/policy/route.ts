import { z } from 'zod'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getCrmAdminDelegablePermissionKeys,
  getCrmPermissionDefinition,
  hasCrmPermission,
  isCrmPermissionKey,
  setCrmAdminDelegablePermissionKeys,
  type CrmPermissionKey,
} from '@/lib/crm-permissions'
import { logCrmActivity } from '@/lib/crm-activity'

const updatePolicySchema = z.object({
  delegablePermissionKeys: z.array(z.string()),
})

export async function PATCH(request: Request) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.access_matrix.delegate'))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = updatePolicySchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const normalizedKeys = parsed.data.delegablePermissionKeys.filter((key): key is CrmPermissionKey =>
      isCrmPermissionKey(key)
    )
    const invalidKeys = parsed.data.delegablePermissionKeys.filter((key) => !isCrmPermissionKey(key))
    if (invalidKeys.length > 0) {
      return errorResponse(`Unknown CRM permission keys: ${invalidKeys.join(', ')}`, 400)
    }

    const nonDelegable = normalizedKeys.filter((key) => !getCrmPermissionDefinition(key).delegableBySuperAdmin)
    if (nonDelegable.length > 0) {
      return errorResponse(`These permissions cannot be delegated: ${nonDelegable.join(', ')}`, 400)
    }

    const saved = await setCrmAdminDelegablePermissionKeys(normalizedKeys, currentUser.id)

    await logCrmActivity({
      action: 'CRM_DELEGATION_POLICY_UPDATED',
      entityType: 'CRM_DELEGATION_POLICY',
      entityId: 'crm-admin-delegation-policy',
      entityLabel: 'CRM delegation policy',
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Updated CRM delegation policy with ${saved.length} delegable permission${saved.length === 1 ? '' : 's'}`,
      metadata: {
        delegablePermissionKeys: saved,
      },
    })

    return successResponse({
      delegablePermissionKeys: saved,
    })
  } catch (error) {
    console.error('Error updating CRM delegation policy:', error)
    return errorResponse('Failed to update CRM delegation policy', 500)
  }
}

export async function GET() {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.access_matrix.view'))) {
      return errorResponse('Forbidden', 403)
    }

    const delegablePermissionKeys = await getCrmAdminDelegablePermissionKeys()
    return successResponse({ delegablePermissionKeys })
  } catch (error) {
    console.error('Error fetching CRM delegation policy:', error)
    return errorResponse('Failed to fetch CRM delegation policy', 500)
  }
}
