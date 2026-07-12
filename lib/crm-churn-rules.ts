import { EmployeeStatus, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getEmployeeByUserId, getManagementChain } from '@/lib/hierarchy'

export const CRM_CHURN_RULES_SETTING_KEY = 'crm_churn_reassignment_rules_v1'

export const CHURN_MANAGEABLE_ROLES = new Set<UserRole>([
  'SUPER_ADMIN',
  'ADMIN',
  'SALES_HEAD',
  'TEAM_LEAD',
])

export const CHURN_TRIGGER_STATUSES = ['junk', 'churned'] as const

export type ChurnRuleScopeType = 'GLOBAL' | 'ADMIN' | 'SALES_HEAD' | 'TEAM_LEAD'
export type ChurnRuleBehavior = 'RESET_TO_NEW_LEAD' | 'SET_FOLLOW_UP_DATE'

export type StoredChurnRule = {
  id: string
  scopeType: ChurnRuleScopeType
  scopeUserId: string | null
  behavior: ChurnRuleBehavior
  followUpDays: number | null
  isActive: boolean
  updatedAt: string
  updatedByUserId: string | null
}

export type ChurnRuleScopeOption = {
  key: string
  scopeType: ChurnRuleScopeType
  scopeUserId: string | null
  label: string
  description: string
  user: {
    id: string
    name: string
    email: string
    role: UserRole
  } | null
}

export type ChurnRuleRecord = StoredChurnRule & {
  scopeKey: string
  scopeLabel: string
  scopeDescription: string
  user: ChurnRuleScopeOption['user']
  updatedByName: string | null
}

type CandidateMetric = {
  assignedThisMonth: number
  openLeadCount: number
  lastAssignedAt: Date | null
}

type ReassignmentCandidate = {
  employeeId: string
  userId: string
  name: string
  email: string
  employeeCode: string
}

export function canManageChurnRulesRole(role: UserRole): boolean {
  return CHURN_MANAGEABLE_ROLES.has(role)
}

export function isChurnTriggerStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
  return CHURN_TRIGGER_STATUSES.includes(normalized as (typeof CHURN_TRIGGER_STATUSES)[number])
}

export function getChurnScopeKey(
  scopeType: ChurnRuleScopeType,
  scopeUserId: string | null
): string {
  return scopeUserId ? `${scopeType}:${scopeUserId}` : scopeType
}

function isScopeType(value: unknown): value is ChurnRuleScopeType {
  return value === 'GLOBAL' || value === 'ADMIN' || value === 'SALES_HEAD' || value === 'TEAM_LEAD'
}

function isBehavior(value: unknown): value is ChurnRuleBehavior {
  return value === 'RESET_TO_NEW_LEAD' || value === 'SET_FOLLOW_UP_DATE'
}

function normalizeRule(input: unknown): StoredChurnRule | null {
  if (!input || typeof input !== 'object') return null

  const record = input as Record<string, unknown>
  if (!isScopeType(record.scopeType) || !isBehavior(record.behavior)) {
    return null
  }

  const scopeUserId =
    typeof record.scopeUserId === 'string' && record.scopeUserId.trim().length > 0
      ? record.scopeUserId.trim()
      : null

  if ((record.scopeType === 'SALES_HEAD' || record.scopeType === 'TEAM_LEAD') && !scopeUserId) {
    return null
  }

  const followUpDays =
    typeof record.followUpDays === 'number' && Number.isFinite(record.followUpDays)
      ? Math.max(1, Math.trunc(record.followUpDays))
      : null

  return {
    id:
      typeof record.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : crypto.randomUUID(),
    scopeType: record.scopeType,
    scopeUserId,
    behavior: record.behavior,
    followUpDays: record.behavior === 'SET_FOLLOW_UP_DATE' ? followUpDays ?? 1 : null,
    isActive: record.isActive !== false,
    updatedAt:
      typeof record.updatedAt === 'string' && record.updatedAt.trim().length > 0
        ? record.updatedAt
        : new Date().toISOString(),
    updatedByUserId:
      typeof record.updatedByUserId === 'string' && record.updatedByUserId.trim().length > 0
        ? record.updatedByUserId.trim()
        : null,
  }
}

export async function getStoredChurnRules(): Promise<StoredChurnRule[]> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: CRM_CHURN_RULES_SETTING_KEY },
    select: { value: true },
  })

  if (!setting?.value) {
    return []
  }

  try {
    const parsed = JSON.parse(setting.value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => normalizeRule(item))
      .filter((item): item is StoredChurnRule => Boolean(item))
      .sort((left, right) => {
        if (left.scopeType !== right.scopeType) {
          return left.scopeType.localeCompare(right.scopeType)
        }
        return (left.scopeUserId ?? '').localeCompare(right.scopeUserId ?? '')
      })
  } catch {
    return []
  }
}

export async function saveStoredChurnRules(
  rules: readonly StoredChurnRule[],
  updatedByUserId: string
): Promise<StoredChurnRule[]> {
  const normalized = rules
    .map((rule) =>
      normalizeRule({
        ...rule,
        updatedAt: rule.updatedAt,
        updatedByUserId: rule.updatedByUserId ?? updatedByUserId,
      })
    )
    .filter((rule): rule is StoredChurnRule => Boolean(rule))

  const unique = new Map<string, StoredChurnRule>()
  for (const rule of normalized) {
    unique.set(getChurnScopeKey(rule.scopeType, rule.scopeUserId), rule)
  }

  const serialized = JSON.stringify(Array.from(unique.values()))
  await prisma.appSetting.upsert({
    where: { key: CRM_CHURN_RULES_SETTING_KEY },
    create: {
      key: CRM_CHURN_RULES_SETTING_KEY,
      value: serialized,
      updatedBy: updatedByUserId,
    },
    update: {
      value: serialized,
      updatedBy: updatedByUserId,
    },
  })

  return Array.from(unique.values())
}

function scopePriority(scopeType: ChurnRuleScopeType): number {
  switch (scopeType) {
    case 'GLOBAL':
      return 0
    case 'TEAM_LEAD':
      return 1
    case 'SALES_HEAD':
      return 2
    case 'ADMIN':
      return 3
  }
}

async function listScopedManagers(role: UserRole) {
  return prisma.user.findMany({
    where: {
      role,
      employee: {
        is: {
          status: EmployeeStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  })
}

export async function getAvailableChurnRuleScopes(currentUser: {
  id: string
  role: UserRole
}): Promise<ChurnRuleScopeOption[]> {
  if (!canManageChurnRulesRole(currentUser.role)) {
    return []
  }

  if (currentUser.role === 'SUPER_ADMIN') {
    const [salesHeads, teamLeads] = await Promise.all([
      listScopedManagers('SALES_HEAD'),
      listScopedManagers('TEAM_LEAD'),
    ])

    return [
      {
        key: getChurnScopeKey('GLOBAL', null),
        scopeType: 'GLOBAL',
        scopeUserId: null,
        label: 'Global override',
        description: 'Applied first across every team when active.',
        user: null,
      },
      {
        key: getChurnScopeKey('ADMIN', null),
        scopeType: 'ADMIN',
        scopeUserId: null,
        label: 'Admin default',
        description: 'Fallback used when no team-level or sales-head rule matches.',
        user: null,
      },
      ...salesHeads.map((user) => ({
        key: getChurnScopeKey('SALES_HEAD', user.id),
        scopeType: 'SALES_HEAD' as const,
        scopeUserId: user.id,
        label: `${user.name} · Sales Head`,
        description: 'Applies to leads under this sales head hierarchy when no team-lead rule matches.',
        user,
      })),
      ...teamLeads.map((user) => ({
        key: getChurnScopeKey('TEAM_LEAD', user.id),
        scopeType: 'TEAM_LEAD' as const,
        scopeUserId: user.id,
        label: `${user.name} · Team Lead`,
        description: 'Applies to BDs in this team lead’s direct team.',
        user,
      })),
    ]
  }

  if (currentUser.role === 'ADMIN') {
    return [
      {
        key: getChurnScopeKey('ADMIN', null),
        scopeType: 'ADMIN',
        scopeUserId: null,
        label: 'Admin default',
        description: 'Fallback used when no team-level rule or global override is active.',
        user: null,
      },
    ]
  }

  const scopedRole = currentUser.role as 'SALES_HEAD' | 'TEAM_LEAD'

  return [
    {
      key: getChurnScopeKey(scopedRole, currentUser.id),
      scopeType: scopedRole,
      scopeUserId: currentUser.id,
      label: `${scopedRole === 'TEAM_LEAD' ? 'My team' : 'My sales scope'}`,
      description:
        scopedRole === 'TEAM_LEAD'
          ? 'Applies to BDs who report directly to you.'
          : 'Applies to leads inside your sales hierarchy when no team-level rule matches.',
      user: {
        id: currentUser.id,
        name: scopedRole,
        email: '',
        role: scopedRole,
      },
    },
  ]
}

export async function getChurnRuleRecords(currentUser: {
  id: string
  role: UserRole
}): Promise<{
  scopes: ChurnRuleScopeOption[]
  rules: ChurnRuleRecord[]
}> {
  const [rules, scopes] = await Promise.all([
    getStoredChurnRules(),
    getAvailableChurnRuleScopes(currentUser),
  ])

  const visibleScopeKeys = new Set(scopes.map((scope) => scope.key))
  const updatedByIds = rules
    .map((rule) => rule.updatedByUserId)
    .filter((value): value is string => Boolean(value))

  const updatedByUsers =
    updatedByIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: updatedByIds } },
          select: { id: true, name: true },
        })
      : []

  const updatedByMap = new Map(updatedByUsers.map((user) => [user.id, user.name]))
  const scopeMap = new Map(scopes.map((scope) => [scope.key, scope]))

  const visibleRules = rules
    .filter((rule) => currentUser.role === 'SUPER_ADMIN' || visibleScopeKeys.has(getChurnScopeKey(rule.scopeType, rule.scopeUserId)))
    .map((rule) => {
      const scope =
        scopeMap.get(getChurnScopeKey(rule.scopeType, rule.scopeUserId)) ??
        {
          key: getChurnScopeKey(rule.scopeType, rule.scopeUserId),
          scopeType: rule.scopeType,
          scopeUserId: rule.scopeUserId,
          label: rule.scopeType,
          description: 'Stored scope',
          user: null,
        }

      return {
        ...rule,
        scopeKey: scope.key,
        scopeLabel: scope.label,
        scopeDescription: scope.description,
        user: scope.user,
        updatedByName: rule.updatedByUserId ? updatedByMap.get(rule.updatedByUserId) ?? null : null,
      }
    })
    .sort((left, right) => {
      return (
        scopePriority(left.scopeType) - scopePriority(right.scopeType) ||
        left.scopeLabel.localeCompare(right.scopeLabel)
      )
    })

  return { scopes, rules: visibleRules }
}

function monthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { start, end }
}

function compareNullableDateAsc(left: Date | null, right: Date | null): number {
  if (left === null && right === null) return 0
  if (left === null) return -1
  if (right === null) return 1
  return left.getTime() - right.getTime()
}

async function getCandidateMetrics(userIds: string[], assignmentDate: Date): Promise<Map<string, CandidateMetric>> {
  const metrics = new Map<string, CandidateMetric>()
  if (userIds.length === 0) {
    return metrics
  }

  const { start, end } = monthBounds(assignmentDate)

  const [assignedThisMonthRows, openLeadRows, latestLeadRows] = await Promise.all([
    prisma.lead.groupBy({
      by: ['bdId'],
      where: {
        bdId: { in: userIds },
        OR: [
          { leadEntryDate: { gte: start, lt: end } },
          { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lt: end } }] },
        ],
      },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['bdId'],
      where: {
        bdId: { in: userIds },
        pipelineStage: { notIn: ['COMPLETED', 'LOST'] },
      },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['bdId'],
      where: { bdId: { in: userIds } },
      _max: { assignedDate: true, createdDate: true },
    }),
  ])

  const assignedMap = new Map(assignedThisMonthRows.map((row) => [row.bdId, row._count._all]))
  const openMap = new Map(openLeadRows.map((row) => [row.bdId, row._count._all]))
  const latestMap = new Map(
    latestLeadRows.map((row) => [row.bdId, row._max.assignedDate ?? row._max.createdDate ?? null])
  )

  for (const userId of userIds) {
    metrics.set(userId, {
      assignedThisMonth: assignedMap.get(userId) ?? 0,
      openLeadCount: openMap.get(userId) ?? 0,
      lastAssignedAt: latestMap.get(userId) ?? null,
    })
  }

  return metrics
}

async function resolveLeadTeamContext(leadOwnerUserId: string) {
  const ownerEmployee = await getEmployeeByUserId(leadOwnerUserId)
  if (!ownerEmployee) {
    throw new Error('Lead owner employee record was not found')
  }

  const chain = await getManagementChain(ownerEmployee.id)
  const teamLead =
    ownerEmployee.user.role === 'TEAM_LEAD'
      ? ownerEmployee
      : chain.find((employee) => employee.user.role === 'TEAM_LEAD') ?? null
  const salesHead =
    ownerEmployee.user.role === 'SALES_HEAD'
      ? ownerEmployee
      : chain.find((employee) => employee.user.role === 'SALES_HEAD') ?? null

  return {
    ownerEmployee,
    teamLead,
    salesHead,
  }
}

async function resolveApplicableChurnRule(leadOwnerUserId: string): Promise<StoredChurnRule | null> {
  const activeRules = (await getStoredChurnRules()).filter((rule) => rule.isActive)
  if (activeRules.length === 0) {
    return null
  }

  const globalRule = activeRules.find((rule) => rule.scopeType === 'GLOBAL')
  if (globalRule) {
    return globalRule
  }

  const { teamLead, salesHead } = await resolveLeadTeamContext(leadOwnerUserId)

  if (teamLead) {
    const teamLeadRule = activeRules.find(
      (rule) => rule.scopeType === 'TEAM_LEAD' && rule.scopeUserId === teamLead.userId
    )
    if (teamLeadRule) {
      return teamLeadRule
    }
  }

  if (salesHead) {
    const salesHeadRule = activeRules.find(
      (rule) => rule.scopeType === 'SALES_HEAD' && rule.scopeUserId === salesHead.userId
    )
    if (salesHeadRule) {
      return salesHeadRule
    }
  }

  return activeRules.find((rule) => rule.scopeType === 'ADMIN') ?? null
}

async function getSameTeamBdCandidates(leadOwnerUserId: string): Promise<{
  teamLead: { employeeId: string; userId: string; name: string } | null
  candidates: ReassignmentCandidate[]
}> {
  const { ownerEmployee, teamLead } = await resolveLeadTeamContext(leadOwnerUserId)

  if (!teamLead) {
    return { teamLead: null, candidates: [] }
  }

  const rows = await prisma.employee.findMany({
    where: {
      managerId: teamLead.id,
      status: EmployeeStatus.ACTIVE,
      user: {
        role: 'BD',
      },
    },
    select: {
      id: true,
      employeeCode: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: {
        name: 'asc',
      },
    },
  })

  const candidates = rows
    .filter((row) => row.userId !== ownerEmployee.userId)
    .map((row) => ({
      employeeId: row.id,
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      employeeCode: row.employeeCode,
    }))

  return {
    teamLead: {
      employeeId: teamLead.id,
      userId: teamLead.userId,
      name: teamLead.user.name,
    },
    candidates,
  }
}

function chooseWinner(
  candidates: ReassignmentCandidate[],
  metrics: Map<string, CandidateMetric>
): ReassignmentCandidate | null {
  const sorted = [...candidates].sort((left, right) => {
    const leftMetric = metrics.get(left.userId) ?? {
      assignedThisMonth: 0,
      openLeadCount: 0,
      lastAssignedAt: null,
    }
    const rightMetric = metrics.get(right.userId) ?? {
      assignedThisMonth: 0,
      openLeadCount: 0,
      lastAssignedAt: null,
    }

    return (
      compareNullableDateAsc(leftMetric.lastAssignedAt, rightMetric.lastAssignedAt) ||
      leftMetric.assignedThisMonth - rightMetric.assignedThisMonth ||
      leftMetric.openLeadCount - rightMetric.openLeadCount ||
      left.name.localeCompare(right.name)
    )
  })

  return sorted[0] ?? null
}

function getNextFollowUpDate(days: number): Date {
  const next = new Date()
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + Math.max(1, Math.trunc(days)))
  return next
}

export async function planChurnLeadReassignment(leadOwnerUserId: string) {
  const rule = await resolveApplicableChurnRule(leadOwnerUserId)
  if (!rule) {
    throw new Error(
      'No active churn reassignment rule matches this lead. Add a global, admin, sales head, or team lead rule first.'
    )
  }

  const { teamLead, candidates } = await getSameTeamBdCandidates(leadOwnerUserId)
  if (!teamLead) {
    throw new Error('This lead does not belong to a team lead hierarchy that supports churn reassignment.')
  }

  if (candidates.length === 0) {
    throw new Error('No eligible business developer is available in the same team for churn reassignment.')
  }

  const metrics = await getCandidateMetrics(
    candidates.map((candidate) => candidate.userId),
    new Date()
  )
  const winner = chooseWinner(candidates, metrics)
  if (!winner) {
    throw new Error('No eligible business developer could be selected for churn reassignment.')
  }

  const assignedAt = new Date()
  const nextStatus =
    rule.behavior === 'RESET_TO_NEW_LEAD' ? 'New Lead' : 'Follow-up 1'
  const followUpDate =
    rule.behavior === 'SET_FOLLOW_UP_DATE'
      ? getNextFollowUpDate(rule.followUpDays ?? 1)
      : null

  return {
    rule,
    teamLead,
    assignee: winner,
    assignedAt,
    nextStatus,
    followUpDate,
  }
}
