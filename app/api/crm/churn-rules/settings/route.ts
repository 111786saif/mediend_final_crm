import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canManageCrmLeadRemarkSettingsRole,
  getCrmLeadRemarkSettings,
  saveCrmLeadRemarkSettings,
} from '@/lib/crm-lead-remarks'
import { logCrmActivity } from '@/lib/crm-activity'
import { getSessionWithFreshUser } from '@/lib/session'

const updateLeadRemarkSettingsSchema = z.object({
  allowAddRemarks: z.boolean(),
  allowRemoveRemarks: z.boolean(),
})

export async function GET() {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!canManageCrmLeadRemarkSettingsRole(currentUser.role)) {
      return errorResponse('Forbidden', 403)
    }

    const settings = await getCrmLeadRemarkSettings()
    return successResponse(settings)
  } catch (error) {
    console.error('Error fetching CRM lead remark settings:', error)
    return errorResponse('Failed to fetch CRM lead remark settings', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!canManageCrmLeadRemarkSettingsRole(currentUser.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = updateLeadRemarkSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid remark-settings payload', 400)
    }

    const previousSettings = await getCrmLeadRemarkSettings()
    const nextSettings = await saveCrmLeadRemarkSettings(parsed.data, currentUser.id)

    await logCrmActivity({
      action: 'CRM_LEAD_REMARK_SETTINGS_UPDATED',
      entityType: 'CRM_SETTINGS',
      entityId: 'crm-lead-remark-settings',
      entityLabel: 'CRM Lead Remark Settings',
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: 'Updated CRM lead remark settings',
      metadata: {
        previousSettings,
        nextSettings,
      },
    })

    return successResponse(nextSettings, 'CRM lead remark settings updated')
  } catch (error) {
    console.error('Error updating CRM lead remark settings:', error)
    return errorResponse('Failed to update CRM lead remark settings', 500)
  }
}
