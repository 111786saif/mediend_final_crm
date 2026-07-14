import { NextRequest } from 'next/server'
import { z } from 'zod'
import { UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canManageChurnRulesRole,
  getStoredChurnRules,
  saveStoredChurnRules,
  type ChurnRuleBehavior,
  type ChurnRuleScopeType,
} from '@/lib/crm-churn-rules'
import { logCrmActivity } from '@/lib/crm-activity'
import { getSessionWithFreshUser } from '@/lib/session'

const updateRuleSchema = z.object({
  behavior: z.enum(['RESET_TO_NEW_LEAD', 'SET_FOLLOW_UP_DATE']),
  followUpDays: z.number().int().min(1).max(60).nullable().optional(),
  isActive: z.boolean(),
})

function canEditScope(
  actor: { id: string; role: UserRole },
  scopeType: ChurnRuleScopeType,
  scopeUserId: string | null
): boolean {
  if (!canManageChurnRulesRole(actor.role)) {
    return false
  }

  if (actor.role === 'SUPER_ADMIN') {
    return true
  }

  if (actor.role === 'ADMIN' || actor.role === 'CRM_ADMIN') {
    return scopeType === 'ADMIN'
  }

  return scopeType === actor.role && scopeUserId === actor.id
}

function normalizeBehaviorDays(behavior: ChurnRuleBehavior, followUpDays: number | null | undefined) {
  return behavior === 'SET_FOLLOW_UP_DATE' ? followUpDays ?? 1 : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!canManageChurnRulesRole(currentUser.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = updateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid churn rule payload', 400)
    }

    const { id } = await params
    const rules = await getStoredChurnRules()
    const existingRule = rules.find((rule) => rule.id === id)
    if (!existingRule) {
      return errorResponse('Churn rule not found', 404)
    }

    if (!canEditScope(currentUser, existingRule.scopeType, existingRule.scopeUserId)) {
      return errorResponse('You cannot edit this churn rule', 403)
    }

    const nextRules = rules.map((rule) =>
      rule.id === id
        ? {
            ...rule,
            behavior: parsed.data.behavior as ChurnRuleBehavior,
            followUpDays: normalizeBehaviorDays(parsed.data.behavior as ChurnRuleBehavior, parsed.data.followUpDays),
            isActive: parsed.data.isActive,
            updatedAt: new Date().toISOString(),
            updatedByUserId: currentUser.id,
          }
        : rule
    )

    await saveStoredChurnRules(nextRules, currentUser.id)

    await logCrmActivity({
      action: 'CRM_CHURN_RULE_UPDATED',
      entityType: 'CRM_CHURN_RULE',
      entityId: existingRule.id,
      entityLabel: `${existingRule.scopeType}${existingRule.scopeUserId ? `:${existingRule.scopeUserId}` : ''}`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Updated churn rule for ${existingRule.scopeType}${existingRule.scopeUserId ? ` (${existingRule.scopeUserId})` : ''}`,
      metadata: {
        scopeType: existingRule.scopeType,
        scopeUserId: existingRule.scopeUserId,
        behavior: parsed.data.behavior,
        followUpDays: normalizeBehaviorDays(parsed.data.behavior as ChurnRuleBehavior, parsed.data.followUpDays),
        isActive: parsed.data.isActive,
      },
    })

    return successResponse({ ok: true }, 'Churn rule updated')
  } catch (error) {
    console.error('Error updating churn rule:', error)
    return errorResponse('Failed to update churn rule', 500)
  }
}
