import { leadIdSchema } from '@/lib/lead-id'
import { z } from 'zod'
import { getSessionWithFreshUser } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { dryRunCrmLeadAssignment } from '@/lib/crm-assignment'
import { logCrmActivity } from '@/lib/crm-activity'

const dryRunSchema = z
  .object({
    leadId: leadIdSchema.optional(),
    city: z.string().trim().optional().nullable(),
    category: z.string().trim().optional().nullable(),
    departmentId: z.string().trim().optional().nullable(),
    assignmentDate: z.string().datetime().optional(),
  })
  .refine(
    (value) => Boolean(value.leadId || value.city || value.category || value.departmentId),
    'Provide leadId or at least one assignment context field.'
  )

export async function POST(request: Request) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await hasCrmPermission(currentUser.id, 'crm.assignment_dry_run.view'))) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = dryRunSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400)
    }

    const result = await dryRunCrmLeadAssignment({
      leadId: parsed.data.leadId || undefined,
      city: parsed.data.city,
      category: parsed.data.category,
      departmentId: parsed.data.departmentId,
      assignmentDate: parsed.data.assignmentDate ? new Date(parsed.data.assignmentDate) : undefined,
    })

    await logCrmActivity({
      action: 'CRM_ASSIGNMENT_DRY_RUN_EXECUTED',
      entityType: 'CRM_ASSIGNMENT_DRY_RUN',
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: parsed.data.leadId
        ? `Ran CRM assignment dry run for lead ${parsed.data.leadId}`
        : 'Ran CRM assignment dry run using manual routing context',
      metadata: {
        input: parsed.data,
        result,
      },
    })

    return successResponse(result)
  } catch (error) {
    console.error('Error running CRM assignment dry run:', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to run assignment dry run', 500)
  }
}
