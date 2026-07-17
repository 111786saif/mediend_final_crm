import {
  CrmAssignmentStrategy,
  EmployeeStatus,
  LeaveRequestStatus,
  Prisma,
  UserRole,
} from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getManagementChain } from '@/lib/hierarchy'

type AssignmentInput = {
  leadId?: string
  city?: string | null
  category?: string | null
  departmentId?: string | null
  assignmentDate?: Date
}

type ImportedLeadAssignmentInput = {
  bdId: string
  bdeName?: string | null
  circle?: string | null
  category?: string | null
  createdDate: Date
  assignedDate?: Date | null
}

type CandidateMetrics = {
  assignedThisMonth: number
  openLeadCount: number
  lastAssignedAt: Date | null
}

type CandidateReason = {
  employeeId: string
  userId: string
  employeeName: string
  eligible: boolean
  reason: string
  metrics?: CandidateMetrics
}

export type CrmAssignmentDryRunResult = {
  input: {
    leadId: string | null
    city: string | null
    category: string | null
    departmentId: string | null
    assignmentDate: string
  }
  matchedRule: null | {
    id: string
    name: string
    strategy: CrmAssignmentStrategy
    priority: number
    city: string | null
    category: string | null
    departmentId: string | null
    departmentName: string | null
    specificity: number
  }
  assignment: null | {
    bd: { employeeId: string; userId: string; name: string }
    teamLead: { employeeId: string; userId: string; name: string } | null
    salesHead: { employeeId: string; userId: string; name: string } | null
    managementChain: Array<{ employeeId: string; userId: string; name: string; role: UserRole }>
    metrics: CandidateMetrics
  }
  candidateDiagnostics: CandidateReason[]
  explanation: string
}

type LoadedRule = Prisma.CrmAssignmentRuleGetPayload<{
  include: {
    department: { select: { id: true; name: true } }
    members: {
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
      include: {
        employee: {
          select: {
            id: true
            userId: true
            circle: true
            departmentId: true
            status: true
            user: { select: { id: true; name: true; role: true } }
          }
        }
      }
    }
  }
}>

function normalize(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function monthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function ruleSpecificity(rule: LoadedRule): number {
  return [rule.city, rule.category, rule.departmentId].filter(Boolean).length
}

function ruleMatches(rule: LoadedRule, input: { city: string | null; category: string | null; departmentId: string | null }): boolean {
  const city = normalize(input.city)
  const category = normalize(input.category)
  const departmentId = input.departmentId ?? null

  if (rule.city && normalize(rule.city) !== city) return false
  if (rule.category && normalize(rule.category) !== category) return false
  if (rule.departmentId && rule.departmentId !== departmentId) return false

  if (rule.city && city === null) return false
  if (rule.category && category === null) return false
  if (rule.departmentId && departmentId === null) return false

  return true
}

async function getRulePoolLeaveSet(employeeIds: string[], assignmentDate: Date): Promise<Set<string>> {
  if (employeeIds.length === 0) return new Set()

  const rows = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: LeaveRequestStatus.APPROVED,
      startDate: { lte: assignmentDate },
      endDate: { gte: assignmentDate },
    },
    select: { employeeId: true },
  })

  return new Set(rows.map((row) => row.employeeId))
}

async function getCandidateMetrics(userIds: string[], assignmentDate: Date): Promise<Map<string, CandidateMetrics>> {
  const metrics = new Map<string, CandidateMetrics>()
  if (userIds.length === 0) return metrics

  const { start, end } = monthBounds(assignmentDate)

  const [assignedThisMonthRows, openLeadRows, latestLeadRows] = await Promise.all([
    prisma.lead.groupBy({
      by: ['bdId'],
      where: {
        bdId: { in: userIds },
        OR: [
          { leadEntryDate: { gte: start, lte: end } },
          { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lte: end } }] },
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

function compareNullableDateAsc(a: Date | null, b: Date | null): number {
  if (a === null && b === null) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a.getTime() - b.getTime()
}

function chooseWinner(
  candidates: Array<{
    employeeId: string
    userId: string
    name: string
    metrics: CandidateMetrics
  }>
) {
  const sorted = [...candidates].sort((left, right) => {
    return (
      compareNullableDateAsc(left.metrics.lastAssignedAt, right.metrics.lastAssignedAt) ||
      left.metrics.assignedThisMonth - right.metrics.assignedThisMonth ||
      left.metrics.openLeadCount - right.metrics.openLeadCount ||
      left.name.localeCompare(right.name)
    )
  })

  return sorted[0] ?? null
}

function getDepartmentMatchScore(departmentName: string, category: string): number {
  const normalizedDepartment = normalize(departmentName)
  const normalizedCategory = normalize(category)
  if (!normalizedDepartment || !normalizedCategory) return 0
  if (normalizedDepartment === normalizedCategory) return 4
  if (normalizedCategory.startsWith(normalizedDepartment)) return 3
  if (normalizedDepartment.startsWith(normalizedCategory)) return 2
  if (normalizedCategory.includes(normalizedDepartment) || normalizedDepartment.includes(normalizedCategory)) {
    return 1
  }
  return 0
}

async function resolveDepartmentFromCategory(category: string | null | undefined) {
  const normalizedCategory = normalize(category)
  if (!normalizedCategory) return null

  const departments = await prisma.department.findMany({
    select: {
      id: true,
      name: true,
    },
  })

  const ranked = departments
    .map((department) => ({
      department,
      score: getDepartmentMatchScore(department.name, normalizedCategory),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      return (
        right.score - left.score ||
        right.department.name.length - left.department.name.length ||
        left.department.name.localeCompare(right.department.name)
      )
    })

  return ranked[0]?.department ?? null
}

async function loadLeadInput(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      circle: true,
      category: true,
    },
  })
}

export async function dryRunCrmLeadAssignment(input: AssignmentInput): Promise<CrmAssignmentDryRunResult> {
  const assignmentDate = input.assignmentDate ?? new Date()

  let leadContext: Awaited<ReturnType<typeof loadLeadInput>> | null = null
  if (input.leadId) {
    leadContext = await loadLeadInput(input.leadId)
    if (!leadContext) {
      throw new Error('Lead not found for dry run')
    }
  }

  const category = input.category ?? leadContext?.category ?? null
  const resolvedDepartment =
    input.departmentId
      ? await prisma.department.findUnique({
          where: { id: input.departmentId },
          select: { id: true, name: true },
        })
      : await resolveDepartmentFromCategory(category)

  const context = {
    leadId: leadContext?.id ?? input.leadId ?? null,
    city: input.city ?? leadContext?.circle ?? null,
    category,
    departmentId: input.departmentId ?? resolvedDepartment?.id ?? null,
  }

  const rules = await prisma.crmAssignmentRule.findMany({
    where: { isActive: true },
    include: {
      department: { select: { id: true, name: true } },
      members: {
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              circle: true,
              departmentId: true,
              status: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  const matchingRules = rules
    .filter((rule) => ruleMatches(rule, context))
    .sort((left, right) => {
      return (
        ruleSpecificity(right) - ruleSpecificity(left) ||
        left.priority - right.priority ||
        left.createdAt.getTime() - right.createdAt.getTime()
      )
    })

  const matchedRule = matchingRules[0] ?? null

  if (!matchedRule) {
    return {
      input: {
        leadId: context.leadId,
        city: context.city,
        category: context.category,
        departmentId: context.departmentId,
        assignmentDate: assignmentDate.toISOString(),
      },
      matchedRule: null,
      assignment: null,
      candidateDiagnostics: [],
      explanation: 'No active assignment rule matched the provided city/category/department context.',
    }
  }

  const candidateMembers = matchedRule.members.filter((member) => member.employee.user.role === UserRole.BD)
  const leaveSet = await getRulePoolLeaveSet(
    candidateMembers.map((member) => member.employeeId),
    assignmentDate
  )
  const metricsMap = await getCandidateMetrics(
    candidateMembers.map((member) => member.employee.user.id),
    assignmentDate
  )

  const diagnostics: CandidateReason[] = []
  const eligibleCandidates: Array<{
    employeeId: string
    userId: string
    name: string
    metrics: CandidateMetrics
  }> = []

  const normalizedCity = normalize(context.city)
  const requiredDepartmentId = context.departmentId
  const requiredDepartmentName = matchedRule.department?.name ?? resolvedDepartment?.name ?? null

  for (const member of candidateMembers) {
    const employee = member.employee
    const metrics =
      metricsMap.get(employee.user.id) ?? {
        assignedThisMonth: 0,
        openLeadCount: 0,
        lastAssignedAt: null,
      }

    if (!member.isActive) {
      diagnostics.push({
        employeeId: employee.id,
        userId: employee.user.id,
        employeeName: employee.user.name,
        eligible: false,
        reason: 'Rule member is inactive.',
      })
      continue
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      diagnostics.push({
        employeeId: employee.id,
        userId: employee.user.id,
        employeeName: employee.user.name,
        eligible: false,
        reason: `Employee status is ${employee.status}.`,
      })
      continue
    }

    if (leaveSet.has(employee.id)) {
      diagnostics.push({
        employeeId: employee.id,
        userId: employee.user.id,
        employeeName: employee.user.name,
        eligible: false,
        reason: 'Employee is on approved leave for the assignment date.',
      })
      continue
    }

    if (normalizedCity && normalize(employee.circle) !== normalizedCity) {
      diagnostics.push({
        employeeId: employee.id,
        userId: employee.user.id,
        employeeName: employee.user.name,
        eligible: false,
        reason: employee.circle
          ? `Employee circle "${employee.circle}" does not match lead city "${context.city}".`
          : `Employee circle is not configured for lead city "${context.city}".`,
      })
      continue
    }

    if (requiredDepartmentId && employee.departmentId !== requiredDepartmentId) {
      diagnostics.push({
        employeeId: employee.id,
        userId: employee.user.id,
        employeeName: employee.user.name,
        eligible: false,
        reason: requiredDepartmentName
          ? `Employee department does not match "${requiredDepartmentName}".`
          : 'Employee department does not match the lead category department.',
      })
      continue
    }

    diagnostics.push({
      employeeId: employee.id,
      userId: employee.user.id,
      employeeName: employee.user.name,
      eligible: true,
      reason: 'Eligible for round-robin assignment.',
      metrics,
    })
    eligibleCandidates.push({
      employeeId: employee.id,
      userId: employee.user.id,
      name: employee.user.name,
      metrics,
    })
  }

  if (eligibleCandidates.length === 0) {
    return {
      input: {
        leadId: context.leadId,
        city: context.city,
        category: context.category,
        departmentId: context.departmentId,
        assignmentDate: assignmentDate.toISOString(),
      },
      matchedRule: {
        id: matchedRule.id,
        name: matchedRule.name,
        strategy: matchedRule.strategy,
        priority: matchedRule.priority,
        city: matchedRule.city,
        category: matchedRule.category,
        departmentId: matchedRule.departmentId,
        departmentName: matchedRule.department?.name ?? null,
        specificity: ruleSpecificity(matchedRule),
      },
      assignment: null,
      candidateDiagnostics: diagnostics,
      explanation: 'A rule matched, but every pool member was excluded by status or leave checks.',
    }
  }

  const winner = chooseWinner(eligibleCandidates)
  if (!winner) {
    throw new Error('Failed to resolve assignment winner')
  }

  const managementChain = await getManagementChain(winner.employeeId)
  const approverChain = managementChain
    .slice(1)
    .map((employee) => ({
      employeeId: employee.id,
      userId: employee.userId,
      name: employee.user.name,
      role: employee.user.role,
    }))

  const teamLead = approverChain.find((employee) => employee.role === UserRole.TEAM_LEAD) ?? null
  const salesHead = approverChain.find((employee) => employee.role === UserRole.SALES_HEAD) ?? null

  return {
    input: {
      leadId: context.leadId,
      city: context.city,
      category: context.category,
      departmentId: context.departmentId,
      assignmentDate: assignmentDate.toISOString(),
    },
    matchedRule: {
      id: matchedRule.id,
      name: matchedRule.name,
      strategy: matchedRule.strategy,
      priority: matchedRule.priority,
      city: matchedRule.city,
      category: matchedRule.category,
      departmentId: matchedRule.departmentId,
      departmentName: matchedRule.department?.name ?? null,
      specificity: ruleSpecificity(matchedRule),
    },
    assignment: {
      bd: {
        employeeId: winner.employeeId,
        userId: winner.userId,
        name: winner.name,
      },
      teamLead: teamLead
        ? {
            employeeId: teamLead.employeeId,
            userId: teamLead.userId,
            name: teamLead.name,
          }
        : null,
      salesHead: salesHead
        ? {
            employeeId: salesHead.employeeId,
            userId: salesHead.userId,
            name: salesHead.name,
          }
        : null,
      managementChain: approverChain,
      metrics: winner.metrics,
    },
    candidateDiagnostics: diagnostics,
    explanation: `Matched rule "${matchedRule.name}" and selected ${winner.name} using round robin after leave, city, and department checks.`,
  }
}

export async function applyCrmAssignmentToImportedLead<T extends ImportedLeadAssignmentInput>(
  leadData: T
): Promise<T> {
  const assignmentDate = leadData.assignedDate ?? leadData.createdDate
  const result = await dryRunCrmLeadAssignment({
    city: leadData.circle ?? null,
    category: leadData.category ?? null,
    assignmentDate,
  })

  if (!result.assignment) {
    return leadData
  }

  return {
    ...leadData,
    bdId: result.assignment.bd.userId,
    bdeName: result.assignment.bd.name,
  }
}
