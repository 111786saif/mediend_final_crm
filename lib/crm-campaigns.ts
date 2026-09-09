import {
  CrmAssignmentStrategy,
  EmployeeStatus,
  FlowType,
  PipelineStage,
  Prisma,
  UserRole,
} from '@/generated/prisma/client'
import type { CrmAssignmentDryRunResult } from '@/lib/crm-assignment'
import { employeeHasAnyCircle, employeeHasCircle, parseEmployeeCircleList } from '@/lib/employee-circles'
import { getManagementChain } from '@/lib/hierarchy'
import { getLeadTeamLeadIdForAssigneeManager } from '@/lib/lead-ownership'
import { withGeneratedManualLeadRef } from '@/lib/manual-lead-ref'
import { prisma } from '@/lib/prisma'
import { resolveInboundSubStatus } from '@/lib/sub-status'
import {
  DUPLICATE_LEAD_STATUS,
  findLatestPriorIncomingLeadByPrimaryPhone,
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'
import { createLeadAssignedNotification } from '@/lib/lead-notifications'

export const CAMPAIGN_MASTER_TYPES = ['source', 'leadSource', 'circle', 'city'] as const

export type CampaignMasterType = (typeof CAMPAIGN_MASTER_TYPES)[number]

export const BUSINESS_TIMEZONE = 'Asia/Kolkata'
const INDIA_OFFSET = '+05:30'
export const CAMPAIGN_ASSIGNMENT_SENTINEL_MONTH = 1
export const CAMPAIGN_ASSIGNMENT_SENTINEL_YEAR = 2000

type CampaignReferenceValidationInput = {
  sourceId: string
  leadSourceId: string
  circleIds: string[]
  category?: string | null
  treatmentMasterId?: string | null
  departmentId?: string | null
}

type ProcessSaveMyLeadsInput = {
  incomingLeadId: string
  externalCampaignId: string
  patientName: string
  phone: string
  email?: string | null
  subStatus?: string | null
  receivedAt?: Date
  circle?: string | null
  category?: string | null
  treatment?: string | null
  source?: string | null
  campaignName?: string | null
}

type CampaignWithRelations = Prisma.CrmCampaignGetPayload<{
  include: {
    source: true
    leadSource: {
      include: {
        source: true
      }
    }
    circle: true
    treatmentMaster: true
    circleSelections: {
      include: {
        circle: true
      }
    }
    city: true
    department: true
    assignments: {
      include: {
        teamLeadEmployee: {
          include: {
            department: true
            user: true
          }
        }
        teamLeadUser: true
      }
    }
    bdDailyLimits: {
      include: {
        bdEmployee: {
          include: {
            department: true
            user: true
          }
        }
      }
    }
  }
}>

type TeamLeadBdOption = {
  id: string
  userId: string
  name: string
  email: string
  employeeCode: string
  circle: string | null
  department: {
    id: string
    name: string
  } | null
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function getZonedParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number.parseInt(lookup.year, 10),
    month: Number.parseInt(lookup.month, 10),
    day: Number.parseInt(lookup.day, 10),
  }
}

function buildBusinessDate(year: number, month: number, day: number, hour: number, minute: number, second: number, ms: number) {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.${String(ms).padStart(3, '0')}${INDIA_OFFSET}`
  )
}

export function getBusinessMonthYear(date: Date = new Date()) {
  const { year, month } = getZonedParts(date)
  return { year, month }
}

export function getBusinessDayRange(date: Date = new Date()) {
  const { year, month, day } = getZonedParts(date)
  const start = buildBusinessDate(year, month, day, 0, 0, 0, 0)
  const end = buildBusinessDate(year, month, day, 23, 59, 59, 999)
  return { start, end }
}

async function getApprovedLeaveSetForDate(employeeIds: string[], date: Date) {
  if (employeeIds.length === 0) return new Set<string>()
  const { start, end } = getBusinessDayRange(date)

  const rows = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: 'APPROVED',
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { employeeId: true },
  })

  return new Set(rows.map((row) => row.employeeId))
}

export function getBusinessMonthRange(year: number, month: number) {
  const start = buildBusinessDate(year, month, 1, 0, 0, 0, 0)
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  const nextMonthStart = buildBusinessDate(nextMonth.year, nextMonth.month, 1, 0, 0, 0, 0)
  const end = new Date(nextMonthStart.getTime() - 1)
  return { start, end }
}

export function normalizePhoneToLast10(raw: string | null | undefined) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

export function isSuperAdmin(user: { role: string } | null | undefined) {
  return user?.role === UserRole.SUPER_ADMIN
}

export async function getDefaultSystemUserId() {
  const preferredRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MD]

  for (const role of preferredRoles) {
    const user = await prisma.user.findFirst({
      where: { role },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (user) return user.id
  }

  const anyUser = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (anyUser) return anyUser.id

  throw new Error('No users found in the system. Cannot process campaign lead.')
}

export async function validateCampaignReferences(input: CampaignReferenceValidationInput) {
  const normalizedCircleIds = Array.from(
    new Set(input.circleIds.map((circleId) => circleId.trim()).filter(Boolean))
  )
  const normalizedCategory = input.category?.trim() || null
  const normalizedTreatmentMasterId = input.treatmentMasterId?.trim() || null

  if (normalizedCircleIds.length === 0) {
    throw new Error('At least one circle must be selected.')
  }

  const [source, leadSource, circles, treatmentCategory, treatmentMaster, department] =
    await Promise.all([
    prisma.crmCampaignSource.findUnique({
      where: { id: input.sourceId },
    }),
    prisma.crmCampaignLeadSource.findUnique({
      where: { id: input.leadSourceId },
    }),
    prisma.crmCampaignCircle.findMany({
      where: {
        id: {
          in: normalizedCircleIds,
        },
      },
    }),
    normalizedCategory
      ? prisma.treatmentCategoryMaster.findUnique({
          where: { name: normalizedCategory },
        })
      : Promise.resolve(null),
    normalizedTreatmentMasterId
      ? prisma.treatmentMaster.findUnique({
          where: { id: normalizedTreatmentMasterId },
        })
      : Promise.resolve(null),
    input.departmentId
      ? prisma.department.findUnique({
          where: { id: input.departmentId },
        })
      : Promise.resolve(null),
    ])

  if (!source) {
    throw new Error('Selected source was not found.')
  }
  if (!leadSource) {
    throw new Error('Selected lead source was not found.')
  }
  if (circles.length !== normalizedCircleIds.length) {
    throw new Error('One or more selected circles were not found.')
  }
  if (normalizedCategory && !treatmentCategory) {
    throw new Error('Selected treatment category was not found.')
  }
  if (normalizedTreatmentMasterId && !treatmentMaster) {
    throw new Error('Selected treatment was not found.')
  }
  if (input.departmentId && !department) {
    throw new Error('Selected department was not found.')
  }
  if (leadSource.sourceId !== source.id) {
    throw new Error('Lead source must belong to the selected source.')
  }
  if (treatmentMaster && normalizedCategory && treatmentMaster.category !== normalizedCategory) {
    throw new Error('Selected treatment does not belong to the selected treatment category.')
  }

  return { source, leadSource, circles, treatmentCategory, treatmentMaster, department }
}

function getCampaignCircles(campaign: Pick<CampaignWithRelations, 'circle' | 'circleSelections'>) {
  const selections = campaign.circleSelections
    .map((selection) => selection.circle)
    .filter(Boolean)

  if (selections.length > 0) {
    return selections
  }

  return campaign.circle ? [campaign.circle] : []
}

export function getCampaignCircleNames(campaign: Pick<CampaignWithRelations, 'circle' | 'circleSelections'> | null | undefined): string[] {
  if (!campaign) return []
  return Array.from(
    new Set(
      getCampaignCircles(campaign)
        .map((circle) => circle?.name?.trim())
        .filter((circleName): circleName is string => Boolean(circleName))
    )
  )
}

export function getCampaignDefaultCircleName(campaign: Pick<CampaignWithRelations, 'circle' | 'circleSelections'> | null | undefined): string | null {
  const circles = getCampaignCircleNames(campaign)
  return circles.length > 0 ? circles[0] : null
}

function resolvePreferredCircleSet(
  campaign: Pick<CampaignWithRelations, 'circle' | 'circleSelections'>,
  preferredCircle?: string | null
) {
  const normalizedPreferred = preferredCircle?.trim()
  if (normalizedPreferred) {
    return [normalizedPreferred]
  }

  return getCampaignCircleNames(campaign)
}

function coalesceCampaignAssignments<
  T extends {
    teamLeadEmployeeId: string
    priority: number
    createdAt: Date
    updatedAt: Date
  },
>(assignments: T[]) {
  const deduped = new Map<string, T>()

  for (const assignment of [...assignments].sort((left, right) => {
    return (
      left.priority - right.priority ||
      right.updatedAt.getTime() - left.updatedAt.getTime() ||
      right.createdAt.getTime() - left.createdAt.getTime()
    )
  })) {
    if (!deduped.has(assignment.teamLeadEmployeeId)) {
      deduped.set(assignment.teamLeadEmployeeId, assignment)
    }
  }

  return [...deduped.values()].sort((left, right) => {
    return (
      left.priority - right.priority ||
      left.createdAt.getTime() - right.createdAt.getTime()
    )
  })
}

export async function getCampaignManagementPageData(month?: number, year?: number) {
  const [sources, leadSources, circles, cities, departments, treatmentCategories, treatments, campaigns, teamLeads, bdEmployees] = await Promise.all([
    prisma.crmCampaignSource.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.crmCampaignLeadSource.findMany({
      include: {
        source: true,
      },
      orderBy: [{ source: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.crmCampaignCircle.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.crmCampaignCity.findMany({
      include: {
        circle: true,
      },
      orderBy: [{ circle: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.treatmentCategoryMaster.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.treatmentMaster.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.crmCampaign.findMany({
      include: {
        source: true,
        leadSource: {
          include: {
            source: true,
          },
        },
        circle: true,
        treatmentMaster: true,
        circleSelections: {
          include: {
            circle: true,
          },
          orderBy: {
            circle: {
              name: 'asc',
            },
          },
        },
        city: true,
        department: true,
        assignments: {
          where: {
            isActive: true,
          },
          include: {
            teamLeadEmployee: {
              include: {
                department: true,
                user: true,
              },
            },
            teamLeadUser: true,
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        },
        bdDailyLimits: {
          include: {
            bdEmployee: {
              include: {
                department: true,
                user: true,
              },
            },
          },
          orderBy: [
            {
              bdEmployee: {
                user: {
                  name: 'asc',
                },
              },
            },
          ],
        },
      },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    }),
    prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        user: {
          // ACM is functionally identical to Team Lead for campaign assignment
          role: { in: [UserRole.TEAM_LEAD, UserRole.ASSISTANT_CATEGORY_MANAGER] },
        },
      },
      include: {
        department: true,
        user: true,
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    }),
    prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        managerId: { not: null },
        user: {
          role: UserRole.BD,
        },
      },
      select: {
        id: true,
        userId: true,
        employeeCode: true,
        managerId: true,
        circle: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ])

  const bdStatsByManagerId = new Map<
    string,
    {
      count: number
      circles: string[]
      bds: TeamLeadBdOption[]
    }
  >()

  for (const bdEmployee of bdEmployees) {
    if (!bdEmployee.managerId) continue
    const stats = bdStatsByManagerId.get(bdEmployee.managerId) ?? {
      count: 0,
      circles: [],
      bds: [],
    }
    stats.count += 1
    for (const circle of parseEmployeeCircleList(bdEmployee.circle)) {
      if (!stats.circles.some((existing) => existing.toLowerCase() === circle.toLowerCase())) {
        stats.circles.push(circle)
      }
    }
    stats.bds.push({
      id: bdEmployee.id,
      userId: bdEmployee.userId,
      name: bdEmployee.user.name,
      email: bdEmployee.user.email,
      employeeCode: bdEmployee.employeeCode,
      circle: bdEmployee.circle,
      department: bdEmployee.department
        ? {
            id: bdEmployee.department.id,
            name: bdEmployee.department.name,
          }
        : null,
    })
    bdStatsByManagerId.set(bdEmployee.managerId, stats)
  }

  const normalizedCampaigns = campaigns.map((campaign) => {
    const coalescedAssignments = coalesceCampaignAssignments(campaign.assignments).map(
      (assignment) => ({
        ...assignment,
        bdDailyLimits: campaign.bdDailyLimits.filter(
          (limit) => limit.teamLeadEmployeeId === assignment.teamLeadEmployeeId
        ),
      })
    )

    return {
      ...campaign,
      assignments: coalescedAssignments,
    }
  })

  return {
    month: month ?? getBusinessMonthYear().month,
    year: year ?? getBusinessMonthYear().year,
    masters: {
      sources,
      leadSources,
      circles,
      cities,
      departments,
      treatmentCategories,
      treatments,
    },
    teamLeads: teamLeads.map((employee) => ({
      id: employee.id,
      userId: employee.userId,
      name: employee.user.name,
      email: employee.user.email,
      employeeCode: employee.employeeCode,
      department: employee.department
        ? {
            id: employee.department.id,
            name: employee.department.name,
          }
        : null,
      circle: employee.circle,
      activeBdCount: bdStatsByManagerId.get(employee.id)?.count ?? 0,
      activeBdCircles: bdStatsByManagerId.get(employee.id)?.circles ?? [],
      activeBds:
        bdStatsByManagerId.get(employee.id)?.bds.sort((left, right) =>
          left.name.localeCompare(right.name)
        ) ?? [],
    })),
    campaigns: normalizedCampaigns.map((campaign) => ({
      ...campaign,
      circleIds: getCampaignCircles(campaign).map((circle) => circle.id),
      circles: getCampaignCircles(campaign),
    })),
  }
}

export async function getCampaignForWebhook(externalCampaignId: string) {
  const campaign = await prisma.crmCampaign.findUnique({
    where: { externalCampaignId },
    include: {
      source: true,
      leadSource: {
        include: {
          source: true,
        },
      },
      circle: true,
      treatmentMaster: true,
      circleSelections: {
        include: {
          circle: true,
        },
        orderBy: {
          circle: {
            name: 'asc',
          },
        },
      },
      city: true,
      department: true,
      assignments: {
        where: {
          isActive: true,
        },
        include: {
          teamLeadEmployee: {
            include: {
              department: true,
              user: true,
            },
          },
          teamLeadUser: true,
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
      bdDailyLimits: {
        include: {
          bdEmployee: {
            include: {
              department: true,
              user: true,
            },
          },
        },
        orderBy: [
          {
            bdEmployee: {
              user: {
                name: 'asc',
              },
            },
          },
        ],
      },
    },
  })

  if (!campaign) {
    return null
  }

  return {
    ...campaign,
    assignments: coalesceCampaignAssignments(campaign.assignments).map((assignment) => ({
      ...assignment,
      bdDailyLimits: campaign.bdDailyLimits.filter(
        (limit) => limit.teamLeadEmployeeId === assignment.teamLeadEmployeeId
      ),
    })),
  }
}

type PreviewCampaignLeadAssignmentInput = {
  externalCampaignId: string
  preferredCircle?: string | null
  category?: string | null
  assignmentDate?: Date
}

export async function previewCampaignLeadAssignment(
  input: PreviewCampaignLeadAssignmentInput
): Promise<{ campaignFound: boolean; result: CrmAssignmentDryRunResult }> {
  const assignmentDate = input.assignmentDate ?? new Date()
  const routingDate = new Date()
  const campaign = await getCampaignForWebhook(input.externalCampaignId)

  const contextCity = input.preferredCircle?.trim() || null
  const contextCategory = input.category ?? campaign?.category ?? null

  if (!campaign) {
    return {
      campaignFound: false,
      result: {
        input: {
          leadId: null,
          city: contextCity,
          category: contextCategory,
          departmentId: null,
          assignmentDate: assignmentDate.toISOString(),
        },
        matchedRule: null,
        assignment: null,
        candidateDiagnostics: [],
        explanation: `Campaign "${input.externalCampaignId}" is not configured in CRM.`,
      },
    }
  }

  const defaultCampaignCircles = getCampaignCircleNames(campaign)
  const preferredCircles = resolvePreferredCircleSet(campaign, contextCity)
  const defaultCampaignCircle = defaultCampaignCircles[0] ?? null

  const matchedRule = {
    id: campaign.id,
    name: `Campaign ${campaign.displayName}`,
    strategy: CrmAssignmentStrategy.ROUND_ROBIN,
    priority: 0,
    city: contextCity ?? defaultCampaignCircle,
    category: contextCategory,
    departmentId: campaign.departmentId ?? null,
    departmentName: campaign.department?.name ?? null,
    specificity: 1,
  }

  if (!campaign.isActive) {
    return {
      campaignFound: true,
      result: {
        input: {
          leadId: null,
          city: contextCity,
          category: contextCategory,
          departmentId: campaign.departmentId ?? null,
          assignmentDate: assignmentDate.toISOString(),
        },
        matchedRule,
        assignment: null,
        candidateDiagnostics: [],
        explanation: `Campaign "${campaign.displayName}" is inactive.`,
      },
    }
  }

  let selectedAssignment: Awaited<ReturnType<typeof chooseTeamLeadAssignment>>
  try {
    selectedAssignment = await chooseTeamLeadAssignment(campaign, routingDate, preferredCircles)
  } catch (error) {
    return {
      campaignFound: true,
      result: {
        input: {
          leadId: null,
          city: contextCity,
          category: contextCategory,
          departmentId: campaign.departmentId ?? null,
          assignmentDate: assignmentDate.toISOString(),
        },
        matchedRule,
        assignment: null,
        candidateDiagnostics: [],
        explanation: error instanceof Error ? error.message : 'Campaign Team Lead selection failed.',
      },
    }
  }

  let selectedBd: Awaited<ReturnType<typeof chooseBdForTeamLead>>
  try {
    selectedBd = await chooseBdForTeamLead(
      campaign.externalCampaignId,
      selectedAssignment.teamLeadEmployeeId,
      preferredCircles,
      campaign.departmentId ?? null,
      campaign.department?.name ?? null,
      routingDate
    )
  } catch (error) {
    const managementChain = await getManagementChain(selectedAssignment.teamLeadEmployeeId)
    const approverChain = managementChain
      .slice(1)
      .map((employee) => ({
        employeeId: employee.id,
        userId: employee.userId,
        name: employee.user.name,
        role: employee.user.role,
      }))

    const categoryManager =
      approverChain.find((employee) => employee.role === UserRole.CATEGORY_MANAGER) ?? null
    const salesHead =
      approverChain.find((employee) => employee.role === UserRole.SALES_HEAD) ?? null
    const bdSelectionError =
      error instanceof Error ? error.message : 'Campaign BD selection failed.'

    return {
      campaignFound: true,
      result: {
        input: {
          leadId: null,
          city: contextCity,
          category: contextCategory,
          departmentId: campaign.departmentId ?? null,
          assignmentDate: assignmentDate.toISOString(),
        },
        matchedRule,
        assignment: {
          bd: {
            employeeId: selectedAssignment.teamLeadEmployeeId,
            userId: selectedAssignment.teamLeadUserId,
            name: selectedAssignment.teamLeadUser.name,
          },
          teamLead: {
            employeeId: selectedAssignment.teamLeadEmployeeId,
            userId: selectedAssignment.teamLeadUserId,
            name: selectedAssignment.teamLeadUser.name,
            role: selectedAssignment.teamLeadUser.role,
          },
          categoryManager: categoryManager
            ? {
                employeeId: categoryManager.employeeId,
                userId: categoryManager.userId,
                name: categoryManager.name,
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
          metrics: {
            assignedThisMonth: 0,
            openLeadCount: 0,
            lastAssignedAt: null,
          },
        },
        candidateDiagnostics: [
          {
            employeeId: selectedAssignment.teamLeadEmployeeId,
            userId: selectedAssignment.teamLeadUserId,
            employeeName: selectedAssignment.teamLeadUser.name,
            eligible: true,
            reason: `No BD was available, so the lead was assigned to Team Lead "${selectedAssignment.teamLeadUser.name}" for manual redistribution.`,
            metrics: {
              assignedThisMonth: 0,
              openLeadCount: 0,
              lastAssignedAt: null,
            },
          },
        ],
        explanation: `${bdSelectionError} Lead will be assigned to Team Lead "${selectedAssignment.teamLeadUser.name}" so it remains visible for manual reassignment.`,
      },
    }
  }

  const managementChain = await getManagementChain(selectedBd.id)
  const approverChain = managementChain
    .slice(1)
    .map((employee) => ({
      employeeId: employee.id,
      userId: employee.userId,
      name: employee.user.name,
      role: employee.user.role,
    }))

  const teamLead =
    approverChain.find(
      (employee) =>
        employee.role === UserRole.TEAM_LEAD ||
        employee.role === UserRole.ASSISTANT_CATEGORY_MANAGER
    ) ?? null
  const categoryManager =
    approverChain.find((employee) => employee.role === UserRole.CATEGORY_MANAGER) ?? null
  const salesHead = approverChain.find((employee) => employee.role === UserRole.SALES_HEAD) ?? null

  return {
    campaignFound: true,
    result: {
      input: {
        leadId: null,
        city: contextCity,
        category: contextCategory,
        departmentId: campaign.departmentId ?? null,
        assignmentDate: assignmentDate.toISOString(),
      },
      matchedRule,
      assignment: {
        bd: {
          employeeId: selectedBd.id,
          userId: selectedBd.userId,
          name: selectedBd.user.name,
        },
        teamLead:
          teamLead ?? {
            employeeId: selectedAssignment.teamLeadEmployeeId,
            userId: selectedAssignment.teamLeadUserId,
            name: selectedAssignment.teamLeadUser.name,
            role: selectedAssignment.teamLeadUser.role,
          },
        categoryManager: categoryManager
          ? {
              employeeId: categoryManager.employeeId,
              userId: categoryManager.userId,
              name: categoryManager.name,
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
        metrics: {
          assignedThisMonth: 0,
          openLeadCount: 0,
          lastAssignedAt: null,
        },
      },
      candidateDiagnostics: [
        {
          employeeId: selectedBd.id,
          userId: selectedBd.userId,
          employeeName: selectedBd.user.name,
          eligible: true,
          reason:
            contextCity && employeeHasCircle(selectedBd.circle, contextCity)
              ? `Selected from campaign pool with preferred circle "${contextCity}".`
              : preferredCircles.length > 1
                ? `Selected from campaign pool within circles: ${preferredCircles.join(', ')}.`
              : 'Selected from campaign pool.',
          metrics: {
            assignedThisMonth: 0,
            openLeadCount: 0,
            lastAssignedAt: null,
          },
        },
      ],
      explanation: contextCity
        ? `Matched campaign "${campaign.displayName}" and selected ${selectedBd.user.name} from the campaign pool, preferring circle "${contextCity}".`
        : preferredCircles.length > 1
          ? `Matched campaign "${campaign.displayName}" and selected ${selectedBd.user.name} from the campaign pool across circles ${preferredCircles.join(', ')}.`
        : `Matched campaign "${campaign.displayName}" and selected ${selectedBd.user.name} from the campaign pool.`,
    },
  }
}

async function chooseTeamLeadAssignment(
  campaign: CampaignWithRelations,
  receivedAt: Date,
  preferredCircles: string[] = []
) {
  const { start, end } = getBusinessDayRange(receivedAt)
  const requiredDepartmentId = campaign.departmentId ?? null
  const requiredDepartmentName = campaign.department?.name ?? null

  const assignments = campaign.assignments.filter(
    (assignment) =>
      assignment.isActive &&
      assignment.teamLeadEmployee.status === EmployeeStatus.ACTIVE &&
      (assignment.teamLeadEmployee.user.role === UserRole.TEAM_LEAD ||
        assignment.teamLeadEmployee.user.role === UserRole.ASSISTANT_CATEGORY_MANAGER) &&
      (!requiredDepartmentId || assignment.teamLeadEmployee.departmentId === requiredDepartmentId)
  )

  let eligibleAssignments = assignments
  const normalizedCircles = Array.from(
    new Set(preferredCircles.map((circle) => circle.trim().toLowerCase()).filter(Boolean))
  )

  if (normalizedCircles.length > 0 && assignments.length > 0) {
    const bdPool = await prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        managerId: {
          in: assignments.map((assignment) => assignment.teamLeadEmployeeId),
        },
        ...(requiredDepartmentId ? { departmentId: requiredDepartmentId } : {}),
        user: {
          role: UserRole.BD,
        },
      },
      select: {
        managerId: true,
        circle: true,
      },
    })

    const eligibleManagerIds = new Set(
      bdPool
        .filter((bd) =>
          normalizedCircles.length > 0
            ? normalizedCircles.some((circle) => employeeHasCircle(bd.circle, circle))
            : employeeHasAnyCircle(bd.circle)
        )
        .map((bd) => bd.managerId)
        .filter((managerId): managerId is string => Boolean(managerId))
    )

    eligibleAssignments = assignments.filter((assignment) =>
      eligibleManagerIds.has(assignment.teamLeadEmployeeId)
    )
  } else if (assignments.length > 0) {
    const bdPool = await prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        managerId: {
          in: assignments.map((assignment) => assignment.teamLeadEmployeeId),
        },
        ...(requiredDepartmentId ? { departmentId: requiredDepartmentId } : {}),
        user: {
          role: UserRole.BD,
        },
      },
      select: {
        managerId: true,
        circle: true,
      },
    })

    const eligibleManagerIds = new Set(
      bdPool
        .filter((bd) => employeeHasAnyCircle(bd.circle))
        .map((bd) => bd.managerId)
        .filter((managerId): managerId is string => Boolean(managerId))
    )

    eligibleAssignments = assignments.filter((assignment) =>
      eligibleManagerIds.has(assignment.teamLeadEmployeeId)
    )
  }

  if (eligibleAssignments.length === 0) {
    if (requiredDepartmentId) {
      throw new Error(
        normalizedCircles.length > 0
          ? requiredDepartmentName
            ? `Campaign has no active Team Lead assignment in the "${requiredDepartmentName}" department covering the selected circles.`
            : 'Campaign has no active Team Lead assignment in the configured department covering the selected circles.'
          : requiredDepartmentName
            ? `Campaign has no active Team Lead assignment in the "${requiredDepartmentName}" department.`
            : 'Campaign has no active Team Lead assignment in the configured department.'
      )
    }
    throw new Error(
      normalizedCircles.length > 0
        ? `Campaign has no active Team Lead assignment covering the selected circles.`
        : 'Campaign has no active Team Lead assignment.'
    )
  }

  const assignmentIds = eligibleAssignments.map((assignment) => assignment.teamLeadEmployeeId)
  const historicalCounts = await prisma.incomingLead.groupBy({
    by: ['selectedTeamLeadEmployeeId'],
    where: {
      status: 'PROCESSED',
      externalCampaignId: campaign.externalCampaignId,
      receivedAt: {
        gte: start,
        lte: end,
      },
      selectedTeamLeadEmployeeId: {
        in: assignmentIds,
      },
    },
    _count: {
      _all: true,
    },
    _max: {
      receivedAt: true,
    },
  })

  const countByTeamLeadId = new Map(
    historicalCounts
      .filter((row) => row.selectedTeamLeadEmployeeId)
      .map((row) => [
        row.selectedTeamLeadEmployeeId as string,
        {
          count: row._count._all,
          lastReceivedAt: row._max.receivedAt,
        },
      ])
  )

  const ranked = [...eligibleAssignments].sort((left, right) => {
    const leftStats = countByTeamLeadId.get(left.teamLeadEmployeeId) ?? {
      count: 0,
      lastReceivedAt: null,
    }
    const rightStats = countByTeamLeadId.get(right.teamLeadEmployeeId) ?? {
      count: 0,
      lastReceivedAt: null,
    }

    const leftScore = leftStats.count / Math.max(left.weight, 1)
    const rightScore = rightStats.count / Math.max(right.weight, 1)

    return (
      leftScore - rightScore ||
      leftStats.count - rightStats.count ||
      (leftStats.lastReceivedAt?.getTime() ?? 0) - (rightStats.lastReceivedAt?.getTime() ?? 0) ||
      left.priority - right.priority ||
      left.createdAt.getTime() - right.createdAt.getTime()
    )
  })

  return ranked[0]
}

async function chooseBdForTeamLead(
  externalCampaignId: string,
  teamLeadEmployeeId: string,
  preferredCircles: string[],
  requiredDepartmentId: string | null,
  requiredDepartmentName: string | null,
  receivedAt: Date
) {
  const { start: dayStart, end: dayEnd } = getBusinessDayRange(receivedAt)

  const bdPool = await prisma.employee.findMany({
    where: {
      status: EmployeeStatus.ACTIVE,
      managerId: teamLeadEmployeeId,
      user: {
        role: UserRole.BD,
      },
    },
    include: {
      user: true,
      department: true,
    },
    orderBy: {
      user: {
        name: 'asc',
      },
    },
  })

  if (bdPool.length === 0) {
    throw new Error('Selected Team Lead has no active BD users available for assignment.')
  }

  const departmentMatchedPool = requiredDepartmentId
    ? bdPool.filter((employee) => employee.departmentId === requiredDepartmentId)
    : bdPool

  if (departmentMatchedPool.length === 0) {
    throw new Error(
      requiredDepartmentName
        ? `Selected Team Lead has no active BDs in the "${requiredDepartmentName}" department.`
        : 'Selected Team Lead has no active BDs in the configured department.'
      )
  }

  const configuredCirclePool = departmentMatchedPool.filter((employee) =>
    employeeHasAnyCircle(employee.circle)
  )

  if (configuredCirclePool.length === 0) {
    throw new Error('Selected Team Lead has no active BDs with circles configured.')
  }

  const normalizedCircles = Array.from(
    new Set(
      preferredCircles
        .map((circle) => circle.trim().toLowerCase())
        .filter(Boolean)
    )
  )
  const circleMatchedPool =
    normalizedCircles.length > 0
      ? configuredCirclePool.filter(
          (employee) =>
            normalizedCircles.some((circle) => employeeHasCircle(employee.circle, circle))
        )
      : []

  if (normalizedCircles.length > 0 && circleMatchedPool.length === 0) {
    throw new Error(
      normalizedCircles.length === 1
        ? `Selected Team Lead has no active BDs in the "${preferredCircles[0]}" circle.`
        : `Selected Team Lead has no active BDs in the selected circles: ${preferredCircles.join(', ')}.`
    )
  }

  const candidates = normalizedCircles.length > 0 ? circleMatchedPool : configuredCirclePool
  const leaveSet = await getApprovedLeaveSetForDate(
    candidates.map((candidate) => candidate.id),
    receivedAt
  )
  const bdDailyLimitRows = await prisma.crmCampaignBdDailyLimit.findMany({
    where: {
      campaign: {
        externalCampaignId,
      },
      teamLeadEmployeeId,
      bdEmployeeId: {
        in: candidates.map((candidate) => candidate.id),
      },
    },
    select: {
      bdEmployeeId: true,
      maxLeadsPerDay: true,
    },
  })
  const dailyLimitByBdEmployeeId = new Map(
    bdDailyLimitRows.map((row) => [row.bdEmployeeId, row.maxLeadsPerDay])
  )

  const [dailyCounts] = await Promise.all([
    prisma.incomingLead.groupBy({
      by: ['selectedBdUserId'],
      where: {
        status: 'PROCESSED',
        externalCampaignId,
        selectedTeamLeadEmployeeId: teamLeadEmployeeId,
        receivedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        selectedBdUserId: {
          in: candidates.map((candidate) => candidate.userId),
        },
      },
      _count: {
        _all: true,
      },
      _max: {
        receivedAt: true,
      },
    }),
  ])

  const countByUserId = new Map(
    dailyCounts
      .filter((row) => row.selectedBdUserId)
      .map((row) => [
        row.selectedBdUserId as string,
        {
          count: row._count._all,
          lastReceivedAt: row._max.receivedAt,
        },
      ])
  )
  const dailyCountByUserId = new Map(countByUserId.entries().map(([userId, stats]) => [userId, stats.count]))

  const eligibleCandidates = candidates.filter((candidate) => {
    if (leaveSet.has(candidate.id)) {
      return false
    }

    const maxLeadsPerDay = dailyLimitByBdEmployeeId.get(candidate.id)
    if (!maxLeadsPerDay || maxLeadsPerDay <= 0) {
      return false
    }

    const assignedToday = dailyCountByUserId.get(candidate.userId) ?? 0
    return assignedToday < maxLeadsPerDay
  })

  if (eligibleCandidates.length === 0) {
    const hasLeaveBlocked = candidates.some((candidate) => leaveSet.has(candidate.id))
    const hasDailyLimitBlocked = candidates.some((candidate) => {
      const maxLeadsPerDay = dailyLimitByBdEmployeeId.get(candidate.id)
      if (!maxLeadsPerDay || maxLeadsPerDay <= 0) return true
      const assignedToday = dailyCountByUserId.get(candidate.userId) ?? 0
      return assignedToday >= maxLeadsPerDay
    })

    if (hasLeaveBlocked && hasDailyLimitBlocked) {
      throw new Error('Selected Team Lead has no BDs available because they are absent, have no Daily max configured, or have reached their daily lead limit.')
    }
    if (hasLeaveBlocked) {
      throw new Error('Selected Team Lead has no BDs available because all matching BDs are absent for the day.')
    }
    if (hasDailyLimitBlocked) {
      throw new Error('Selected Team Lead has no BDs available because all matching BDs have no Daily max configured or have reached their daily lead limit.')
    }
    throw new Error('Selected Team Lead has no active BD users available for assignment.')
  }

  const ranked = [...eligibleCandidates].sort((left, right) => {
    const leftStats = countByUserId.get(left.userId) ?? {
      count: 0,
      lastReceivedAt: null,
    }
    const rightStats = countByUserId.get(right.userId) ?? {
      count: 0,
      lastReceivedAt: null,
    }

    return (
      leftStats.count - rightStats.count ||
      (leftStats.lastReceivedAt?.getTime() ?? 0) - (rightStats.lastReceivedAt?.getTime() ?? 0) ||
      left.user.name.localeCompare(right.user.name)
    )
  })

  return ranked[0]
}

export async function processSaveMyLeadsIncomingLead(input: ProcessSaveMyLeadsInput) {
  const receivedAt = input.receivedAt ?? new Date()
  const routingDate = new Date()
  const normalizedPhone = normalizeLeadPhoneToLast10(input.phone)

  if (!normalizedPhone) {
    await prisma.incomingLead.update({
      where: { id: input.incomingLeadId },
      data: {
        status: 'FAILED',
        externalCampaignId: input.externalCampaignId,
        errorMessage: 'Phone number must contain at least 10 digits.',
        processedAt: receivedAt,
      },
    })
    throw new Error('Phone number must contain at least 10 digits.')
  }

  const priorIncomingLead = await findLatestPriorIncomingLeadByPrimaryPhone(normalizedPhone, {
    excludeIncomingLeadId: input.incomingLeadId,
    beforeReceivedAt: receivedAt,
  })
  const hasPriorIncomingDuplicate = Boolean(
    priorIncomingLead && !priorIncomingLead.processedLeadId
  )

  const campaign = await getCampaignForWebhook(input.externalCampaignId)

  if (!campaign || !campaign.isActive) {
    await prisma.incomingLead.update({
      where: { id: input.incomingLeadId },
      data: {
        status: 'FAILED',
        externalCampaignId: input.externalCampaignId,
        normalizedPhone,
        errorMessage: 'Campaign is not configured or inactive.',
        processedAt: receivedAt,
      },
    })
    throw new Error('Campaign is not configured or inactive.')
  }

  const preferredCircles = getCampaignCircleNames(campaign)
  const selectedAssignment = await chooseTeamLeadAssignment(campaign, routingDate, preferredCircles)
  let selectedBd: {
    id: string
    userId: string
    user: {
      id: string
      name: string
      role: UserRole
    }
  }
  let assignedToTeamLeadFallback = false
  try {
    selectedBd = await chooseBdForTeamLead(
      campaign.externalCampaignId,
      selectedAssignment.teamLeadEmployeeId,
      preferredCircles,
      campaign.departmentId ?? null,
      campaign.department?.name ?? null,
      routingDate
    )
  } catch {
    assignedToTeamLeadFallback = true
    selectedBd = {
      id: selectedAssignment.teamLeadEmployeeId,
      userId: selectedAssignment.teamLeadUserId,
      user: {
        id: selectedAssignment.teamLeadUserId,
        name: selectedAssignment.teamLeadUser.name,
        role: selectedAssignment.teamLeadUser.role,
      },
    }
  }

  const cleanStr = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s) return null
    const lower = s.toLowerCase()
    if (['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(lower)) return null
    return s
  }

  const campaignCircles = getCampaignCircleNames(campaign)
  const explicitCircle = cleanStr(input.circle)
  const finalCircle = explicitCircle ?? (campaignCircles.length === 1 ? campaignCircles[0] : '')
  const finalCategory = cleanStr(input.category) ?? cleanStr(campaign.category)
  const finalTreatment = cleanStr(input.treatment) ?? cleanStr(campaign.treatment)
  const finalSource = cleanStr(campaign.source.name) ?? cleanStr(input.source)
  const payloadCampaignName = cleanStr(input.campaignName)
  const finalCampaignName =
    cleanStr(campaign.displayName) ??
    payloadCampaignName ??
    campaign.externalCampaignId

  const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone, finalTreatment)
  const isDuplicate = Boolean(duplicateLead) || hasPriorIncomingDuplicate

  const systemUserId = await getDefaultSystemUserId()
  const resolvedSubStatus = await resolveInboundSubStatus(input.subStatus)
  const teamLeadId = await getLeadTeamLeadIdForAssigneeManager(selectedBd.userId)

  const lead = await withGeneratedManualLeadRef((leadRef) =>
    prisma.lead.create({
      data: {
        leadRef,
        patientName: input.patientName.trim(),
        age: 0,
        sex: 'Not Specified',
        phoneNumber: input.phone.trim(),
        status: isDuplicate ? DUPLICATE_LEAD_STATUS : 'New Lead',
        pipelineStage: PipelineStage.SALES,
        flowType: FlowType.INSURANCE,
        hospitalName: 'Not Specified',
        createdById: systemUserId,
        updatedById: systemUserId,
        createdDate: receivedAt,
        leadEntryDate: receivedAt,
        assignedDate: receivedAt,
        source: finalSource,
        campaignName: finalCampaignName,
        campaignId: campaign.externalCampaignId,
        category: finalCategory,
        treatment: finalTreatment,
        treatmentMasterId:
          finalTreatment === cleanStr(campaign.treatment)
            ? (campaign.treatmentMasterId ?? null)
            : null,
        subStatus: resolvedSubStatus,
        circle: finalCircle,
        bdeName: selectedBd.user.name,
        bdId: selectedBd.userId,
        teamLeadId,
        duplCount: 0,
      },
      select: {
        id: true,
        leadRef: true,
      },
    })
  )

  if (selectedBd?.userId) {
    await createLeadAssignedNotification({
      userId: selectedBd.userId,
      patientName: input.patientName,
      leadRef: lead.leadRef,
      leadId: lead.id,
    })
  }

  await prisma.incomingLead.update({
    where: { id: input.incomingLeadId },
    data: {
      status: isDuplicate ? 'DUPLICATE' : 'PROCESSED',
      externalCampaignId: campaign.externalCampaignId,
      normalizedPhone,
      processedLeadId: lead.id,
      selectedTeamLeadUserId: selectedAssignment.teamLeadUserId,
      selectedTeamLeadEmployeeId: selectedAssignment.teamLeadEmployeeId,
      selectedBdUserId: assignedToTeamLeadFallback ? null : selectedBd.userId,
      processedAt: receivedAt,
      errorMessage: duplicateLead
        ? `Duplicate phone number. Existing lead: ${duplicateLead.leadRef}. Duplicate count: ${duplicateLead.duplCount}`
        : hasPriorIncomingDuplicate && priorIncomingLead
          ? `Duplicate phone number. Existing incoming lead: ${priorIncomingLead.id}`
          : null,
    },
  })

  return {
    success: true,
    deduplicated: isDuplicate,
    leadId: lead.id,
    leadRef: lead.leadRef,
    campaign: {
      id: campaign.id,
      externalCampaignId: campaign.externalCampaignId,
      displayName: campaign.displayName,
    },
    teamLead: {
      employeeId: selectedAssignment.teamLeadEmployeeId,
      userId: selectedAssignment.teamLeadUserId,
      name: selectedAssignment.teamLeadUser.name,
    },
    bd: {
      employeeId: selectedBd.id,
      userId: selectedBd.userId,
      name: selectedBd.user.name,
    },
    assignedToTeamLeadFallback,
  }
}
