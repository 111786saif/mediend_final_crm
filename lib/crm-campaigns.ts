import {
  EmployeeStatus,
  FlowType,
  PipelineStage,
  Prisma,
  UserRole,
} from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export const CAMPAIGN_MASTER_TYPES = ['source', 'leadSource', 'circle', 'city'] as const

export type CampaignMasterType = (typeof CAMPAIGN_MASTER_TYPES)[number]

export const BUSINESS_TIMEZONE = 'Asia/Kolkata'
const INDIA_OFFSET = '+05:30'

type CampaignReferenceValidationInput = {
  sourceId: string
  leadSourceId: string
  circleId: string
  cityId?: string | null
  departmentId?: string | null
}

type ProcessSaveMyLeadsInput = {
  incomingLeadId: string
  externalCampaignId: string
  patientName: string
  phone: string
  email?: string | null
  receivedAt?: Date
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
  }
}>

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
  const [source, leadSource, circle, city, department] = await Promise.all([
    prisma.crmCampaignSource.findUnique({
      where: { id: input.sourceId },
    }),
    prisma.crmCampaignLeadSource.findUnique({
      where: { id: input.leadSourceId },
    }),
    prisma.crmCampaignCircle.findUnique({
      where: { id: input.circleId },
    }),
    input.cityId
      ? prisma.crmCampaignCity.findUnique({
          where: { id: input.cityId },
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
  if (!circle) {
    throw new Error('Selected circle was not found.')
  }
  if (input.cityId && !city) {
    throw new Error('Selected city was not found.')
  }
  if (input.departmentId && !department) {
    throw new Error('Selected department was not found.')
  }
  if (leadSource.sourceId !== source.id) {
    throw new Error('Lead source must belong to the selected source.')
  }
  if (city && city.circleId !== circle.id) {
    throw new Error('City must belong to the selected circle.')
  }

  return { source, leadSource, circle, city, department }
}

export async function getCampaignManagementPageData(month: number, year: number) {
  const [sources, leadSources, circles, cities, departments, campaigns, teamLeads, bdCounts] = await Promise.all([
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
    prisma.crmCampaign.findMany({
      include: {
        source: true,
        leadSource: {
          include: {
            source: true,
          },
        },
        circle: true,
        city: true,
        department: true,
        assignments: {
          where: {
            month,
            year,
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
      },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    }),
    prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        user: {
          role: UserRole.TEAM_LEAD,
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
    prisma.employee.groupBy({
      by: ['managerId'],
      where: {
        status: EmployeeStatus.ACTIVE,
        managerId: { not: null },
        user: {
          role: UserRole.BD,
        },
      },
      _count: {
        _all: true,
      },
    }),
  ])

  const bdCountByManagerId = new Map(
    bdCounts
      .filter((row) => row.managerId)
      .map((row) => [row.managerId as string, row._count._all])
  )

  return {
    month,
    year,
    masters: {
      sources,
      leadSources,
      circles,
      cities,
      departments,
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
      activeBdCount: bdCountByManagerId.get(employee.id) ?? 0,
    })),
    campaigns,
  }
}

async function getCampaignForWebhook(externalCampaignId: string, month: number, year: number) {
  return prisma.crmCampaign.findUnique({
    where: { externalCampaignId },
    include: {
      source: true,
      leadSource: {
        include: {
          source: true,
        },
      },
      circle: true,
      city: true,
      department: true,
      assignments: {
        where: {
          month,
          year,
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
    },
  })
}

async function chooseTeamLeadAssignment(campaign: CampaignWithRelations, receivedAt: Date) {
  const { month, year } = getBusinessMonthYear(receivedAt)
  const { start, end } = getBusinessMonthRange(year, month)
  const requiredDepartmentId = campaign.departmentId ?? null
  const requiredDepartmentName = campaign.department?.name ?? null

  const assignments = campaign.assignments.filter(
    (assignment) =>
      assignment.isActive &&
      assignment.teamLeadEmployee.status === EmployeeStatus.ACTIVE &&
      assignment.teamLeadEmployee.user.role === UserRole.TEAM_LEAD &&
      (!requiredDepartmentId || assignment.teamLeadEmployee.departmentId === requiredDepartmentId)
  )

  if (assignments.length === 0) {
    if (requiredDepartmentId) {
      throw new Error(
        requiredDepartmentName
          ? `Campaign has no active Team Lead assignment in the "${requiredDepartmentName}" department for the current month.`
          : 'Campaign has no active Team Lead assignment in the configured department for the current month.'
      )
    }
    throw new Error('Campaign has no active Team Lead assignment for the current month.')
  }

  const assignmentIds = assignments.map((assignment) => assignment.teamLeadEmployeeId)
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

  const ranked = [...assignments].sort((left, right) => {
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
  preferredCircle: string | null,
  requiredDepartmentId: string | null,
  requiredDepartmentName: string | null,
  receivedAt: Date
) {
  const { month, year } = getBusinessMonthYear(receivedAt)
  const { start, end } = getBusinessMonthRange(year, month)

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

  const normalizedCircle = preferredCircle?.trim().toLowerCase() ?? null
  const circleMatchedPool =
    normalizedCircle
      ? departmentMatchedPool.filter(
          (employee) => employee.circle?.trim().toLowerCase() === normalizedCircle
        )
      : []
  const candidates = circleMatchedPool.length > 0 ? circleMatchedPool : departmentMatchedPool

  const historicalCounts = await prisma.incomingLead.groupBy({
    by: ['selectedBdUserId'],
    where: {
      status: 'PROCESSED',
      externalCampaignId,
      selectedTeamLeadEmployeeId: teamLeadEmployeeId,
      receivedAt: {
        gte: start,
        lte: end,
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
  })

  const countByUserId = new Map(
    historicalCounts
      .filter((row) => row.selectedBdUserId)
      .map((row) => [
        row.selectedBdUserId as string,
        {
          count: row._count._all,
          lastReceivedAt: row._max.receivedAt,
        },
      ])
  )

  const ranked = [...candidates].sort((left, right) => {
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

async function findDuplicateLead(externalCampaignId: string, normalizedPhone: string, receivedAt: Date) {
  const { start, end } = getBusinessDayRange(receivedAt)

  return prisma.lead.findFirst({
    where: {
      campaignId: externalCampaignId,
      createdDate: {
        gte: start,
        lte: end,
      },
      OR: [
        { phoneNumber: { contains: normalizedPhone } },
        { alternateNumber: { contains: normalizedPhone } },
      ],
    },
    select: {
      id: true,
      leadRef: true,
      bdId: true,
      patientName: true,
      createdDate: true,
    },
    orderBy: {
      createdDate: 'desc',
    },
  })
}

export async function processSaveMyLeadsIncomingLead(input: ProcessSaveMyLeadsInput) {
  const receivedAt = input.receivedAt ?? new Date()
  const normalizedPhone = normalizePhoneToLast10(input.phone)

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

  const { month, year } = getBusinessMonthYear(receivedAt)
  const campaign = await getCampaignForWebhook(input.externalCampaignId, month, year)

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

  const selectedAssignment = await chooseTeamLeadAssignment(campaign, receivedAt)
  const selectedBd = await chooseBdForTeamLead(
    campaign.externalCampaignId,
    selectedAssignment.teamLeadEmployeeId,
    campaign.circle.name,
    campaign.departmentId ?? null,
    campaign.department?.name ?? null,
    receivedAt
  )

  const duplicateLead = await findDuplicateLead(campaign.externalCampaignId, normalizedPhone, receivedAt)
  if (duplicateLead) {
    await prisma.incomingLead.update({
      where: { id: input.incomingLeadId },
      data: {
        status: 'DUPLICATE',
        externalCampaignId: campaign.externalCampaignId,
        normalizedPhone,
        processedLeadId: duplicateLead.id,
        selectedTeamLeadUserId: selectedAssignment.teamLeadUserId,
        selectedTeamLeadEmployeeId: selectedAssignment.teamLeadEmployeeId,
        selectedBdUserId: selectedBd.userId,
        processedAt: receivedAt,
        errorMessage: null,
      },
    })

    return {
      success: true,
      deduplicated: true,
      leadId: duplicateLead.id,
      leadRef: duplicateLead.leadRef,
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
    }
  }

  const systemUserId = await getDefaultSystemUserId()
  const leadRef = `SML-${campaign.externalCampaignId}-${crypto.randomUUID()}`

  const lead = await prisma.lead.create({
    data: {
      leadRef,
      patientName: input.patientName.trim(),
      age: 0,
      sex: 'Not Specified',
      phoneNumber: input.phone.trim(),
      status: 'New Lead',
      pipelineStage: PipelineStage.SALES,
      flowType: FlowType.INSURANCE,
      circle: campaign.circle.name,
      hospitalName: 'Not Specified',
      createdById: systemUserId,
      updatedById: systemUserId,
      createdDate: receivedAt,
      leadEntryDate: receivedAt,
      assignedDate: receivedAt,
      source: campaign.source.name,
      campaignName: campaign.leadSource.name || campaign.displayName,
      campaignId: campaign.externalCampaignId,
      category: campaign.category ?? null,
      bdeName: selectedBd.user.name,
      bdId: selectedBd.userId,
    },
    select: {
      id: true,
      leadRef: true,
    },
  })

  await prisma.incomingLead.update({
    where: { id: input.incomingLeadId },
    data: {
      status: 'PROCESSED',
      externalCampaignId: campaign.externalCampaignId,
      normalizedPhone,
      processedLeadId: lead.id,
      selectedTeamLeadUserId: selectedAssignment.teamLeadUserId,
      selectedTeamLeadEmployeeId: selectedAssignment.teamLeadEmployeeId,
      selectedBdUserId: selectedBd.userId,
      processedAt: receivedAt,
      errorMessage: null,
    },
  })

  return {
    success: true,
    deduplicated: false,
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
  }
}
