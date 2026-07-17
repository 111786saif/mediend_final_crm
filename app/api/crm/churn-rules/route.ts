import { NextRequest } from 'next/server'
import { z } from 'zod'
import { UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canManageCrmLeadRemarkSettingsRole,
  getCrmLeadRemarkSettings,
} from '@/lib/crm-lead-remarks'
import {
  canManageChurnRulesRole,
  getAvailableChurnRuleScopes,
  getChurnRuleRecords,
  getChurnScopeKey,
  getStoredChurnRules,
  saveStoredChurnRules,
  type ChurnRuleBehavior,
  type ChurnRuleScopeType,
} from '@/lib/crm-churn-rules'
import { logCrmActivity } from '@/lib/crm-activity'
import { getSessionWithFreshUser } from '@/lib/session'

const createRuleSchema = z.object({
  scopeType: z.enum(['GLOBAL', 'ADMIN', 'SALES_HEAD', 'TEAM_LEAD']),
  scopeUserId: z.string().trim().min(1).nullable().optional(),
  behavior: z.enum(['RESET_TO_NEW_LEAD', 'SET_FOLLOW_UP_DATE']),
  followUpDays: z.number().int().min(1).max(60).nullable().optional(),
  isActive: z.boolean().optional(),
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

export async function GET() {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!canManageChurnRulesRole(currentUser.role)) {
      return errorResponse('Forbidden', 403)
    }

    const [{ rules, scopes }, remarkSettings] = await Promise.all([
      getChurnRuleRecords(currentUser),
      getCrmLeadRemarkSettings(),
    ])

    return successResponse({
      currentUser: {
        id: currentUser.id,
        role: currentUser.role,
        canManageGlobal: currentUser.role === 'SUPER_ADMIN',
        canManageRemarkSettings: canManageCrmLeadRemarkSettingsRole(currentUser.role),
      },
      scopes,
      rules,
      remarkSettings,
      precedence: [
        'Super Admin global override',
        'Team Lead rule',
        'Sales Head rule',
        'CRM Admin default',
      ],
    })
  } catch (error) {
    console.error('Error fetching churn rules:', error)
    return errorResponse('Failed to fetch churn rules', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!canManageChurnRulesRole(currentUser.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const parsed = createRuleSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid churn rule payload', 400)
    }

    const scopeType = parsed.data.scopeType as ChurnRuleScopeType
    const scopeUserId = parsed.data.scopeUserId ?? null
    if (!canEditScope(currentUser, scopeType, scopeUserId)) {
      return errorResponse('You cannot create a churn rule for this scope', 403)
    }

    const availableScopes = await getAvailableChurnRuleScopes(currentUser)
    const scopeKey = getChurnScopeKey(scopeType, scopeUserId)
    if (!availableScopes.some((scope) => scope.key === scopeKey)) {
      return errorResponse('This churn-rule scope is not available for your account', 400)
    }

    const existingRules = await getStoredChurnRules()
    if (existingRules.some((rule) => getChurnScopeKey(rule.scopeType, rule.scopeUserId) === scopeKey)) {
      return errorResponse('A churn rule already exists for this scope. Edit it instead.', 409)
    }

    const nextRules = [
      ...existingRules,
      {
        id: crypto.randomUUID(),
        scopeType,
        scopeUserId,
        behavior: parsed.data.behavior as ChurnRuleBehavior,
        followUpDays: normalizeBehaviorDays(parsed.data.behavior as ChurnRuleBehavior, parsed.data.followUpDays),
        isActive: parsed.data.isActive ?? true,
        updatedAt: new Date().toISOString(),
        updatedByUserId: currentUser.id,
      },
    ]

    await saveStoredChurnRules(nextRules, currentUser.id)
    const data = await getChurnRuleRecords(currentUser)

    await logCrmActivity({
      action: 'CRM_CHURN_RULE_CREATED',
      entityType: 'CRM_CHURN_RULE',
      entityId: scopeKey,
      entityLabel: `${scopeType}${scopeUserId ? `:${scopeUserId}` : ''}`,
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      request,
      summary: `Created churn rule for ${scopeType}${scopeUserId ? ` (${scopeUserId})` : ''}`,
      metadata: {
        scopeType,
        scopeUserId,
        behavior: parsed.data.behavior,
        followUpDays: normalizeBehaviorDays(parsed.data.behavior as ChurnRuleBehavior, parsed.data.followUpDays),
        isActive: parsed.data.isActive ?? true,
      },
    })

    return successResponse(data, 'Churn rule created')
  } catch (error) {
    console.error('Error creating churn rule:', error)
    return errorResponse('Failed to create churn rule', 500)
  }
}
