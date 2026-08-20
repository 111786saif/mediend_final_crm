import { EmployeeStatus, FlowType, PipelineStage, UserRole } from '@/generated/prisma/client'
import { logCrmActivity } from '@/lib/crm-activity'
import { getBusinessMonthYear, getDefaultSystemUserId } from '@/lib/crm-campaigns'
import {
  findLatestPriorIncomingLeadByPrimaryPhone,
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'
import { prisma } from '@/lib/prisma'
import { loadLookupMaps, type LookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { mapMySQLLeadToPrismaWithoutOwner, type MySQLLeadRow } from '@/lib/sync/mysql-lead-mapper'

type AssignableUserContext = {
  userId: string
  userName: string
  userRole: UserRole
  managerUserId: string | null
  managerEmployeeId: string | null
  managerLeadId: number | null
}

type IncomingLeadForManualAssign = {
  id: string
  source: string | null
  status: string
  payload: unknown
  processedLeadId: string | null
  externalCampaignId: string | null
  normalizedPhone: string | null
  receivedAt: Date
}

type ManualAssignResultItem = {
  incomingLeadId: string
  status: 'processed' | 'duplicate' | 'failed' | 'already_processed'
  leadId?: string
  leadRef?: string
  bdName?: string
  error?: string
}

export type ManualAssignIncomingLeadsResult = {
  processedCount: number
  duplicateCount: number
  failedCount: number
  results: ManualAssignResultItem[]
}

function emptyLookupMaps(): LookupMaps {
  return {
    source: new Map(),
    campaign: new Map(),
    category: new Map(),
    treatment: new Map(),
    circle: new Map(),
    status: new Map(),
  }
}

type ManualAssignActor = {
  id: string
  name: string
  role: string
}

async function loadLookupMapsForManualAssign(): Promise<LookupMaps> {
  try {
    return await loadLookupMaps()
  } catch (error) {
    console.warn(
      '[manual-assign] Falling back to empty MySQL lookups:',
      error instanceof Error ? error.message : error
    )
    return emptyLookupMaps()
  }
}

function getPayloadRecord(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  return payload as Record<string, unknown>
}

function getMySQLLeadFromPayload(payload: unknown): MySQLLeadRow | null {
  const record = getPayloadRecord(payload)
  if (!record) return null
  const mysqlLead = record.mysqlLead
  if (!mysqlLead || typeof mysqlLead !== 'object' || Array.isArray(mysqlLead)) {
    return null
  }
  return mysqlLead as MySQLLeadRow
}

function getSaveMyLeadsPayloadRecord(payload: unknown) {
  const record = getPayloadRecord(payload)
  if (!record) return {}
  const nested = record.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }
  return record
}

function extractSaveMyLeadsFields(payload: unknown) {
  const record = getSaveMyLeadsPayloadRecord(payload)
  const campaignId =
    record.campaignId ??
    record['campaign id'] ??
    record.campaign_id ??
    record.campaign ??
    null
  const name = record.name ?? record.patientName ?? record.patient_name ?? record.Patient_Name ?? null
  const phone = record.phone ?? record.phoneNumber ?? record.mobile ?? record.mobileNumber ?? record.Patient_Number ?? null
  const email = record.email ?? record.PatientEmail ?? null

  const circle = record.circle ?? record.Circle ?? record.city ?? record.city_option ?? null
  const category = record.category ?? record.Category ?? null
  const treatment = record.treatment ?? record.Treatment ?? null
  const source = record.source ?? record.Source ?? null
  const campaignName = record.campaignName ?? record.campaign_name ?? record.Lead_Source ?? null

  const clean = (v: unknown) => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s) return null
    const lower = s.toLowerCase()
    if (['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(lower)) return null
    return s
  }

  return {
    campaignId: clean(campaignId),
    patientName: clean(name),
    phone: clean(phone),
    email: clean(email),
    circle: clean(circle),
    category: clean(category),
    treatment: clean(treatment),
    source: clean(source),
    campaignName: clean(campaignName),
  }
}

const MANUAL_ASSIGNABLE_USER_ROLES = [
  UserRole.BD,
  UserRole.TEAM_LEAD,
  UserRole.CATEGORY_MANAGER,
  UserRole.SALES_HEAD,
  UserRole.EXECUTIVE_ASSISTANT,
  UserRole.MD,
] as const

async function getAssignableUserContexts(userIds: string[]) {
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      role: { in: [...MANUAL_ASSIGNABLE_USER_ROLES] },
      employee: {
        is: {
          status: EmployeeStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      role: true,
      employee: {
        select: {
          id: true,
          manager: {
            select: {
              id: true,
              userId: true,
              bdNumber: true,
            },
          },
        },
      },
    },
  })

  return new Map<string, AssignableUserContext>(
    users.map((user) => [
      user.id,
      {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        managerUserId: user.employee?.manager?.userId ?? null,
        managerEmployeeId: user.employee?.manager?.id ?? null,
        managerLeadId: user.employee?.manager?.bdNumber ?? null,
      },
    ])
  )
}

async function loadWebhookCampaign(externalCampaignId: string) {
  return prisma.crmCampaign.findUnique({
    where: { externalCampaignId },
    include: {
      source: true,
      leadSource: true,
      circle: true,
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
    },
  })
}

function getCampaignCircleNames(campaign: {
  circle: { name: string } | null
  circleSelections: Array<{ circle: { name: string } }>
}) {
  if (campaign.circleSelections.length > 0) {
    return campaign.circleSelections.map((selection) => selection.circle.name)
  }
  return campaign.circle?.name ? [campaign.circle.name] : []
}

async function reassignExistingLead(
  incomingLead: IncomingLeadForManualAssign,
  bd: AssignableUserContext,
  actor: ManualAssignActor
): Promise<ManualAssignResultItem> {
  if (!incomingLead.processedLeadId) {
    throw new Error('Incoming lead is not linked to a created lead yet')
  }

  const existingLead = await prisma.lead.findUnique({
    where: { id: incomingLead.processedLeadId },
    select: {
      id: true,
      leadRef: true,
      patientName: true,
      bdId: true,
      assignedDate: true,
      bd: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!existingLead) {
    throw new Error('Linked lead could not be found for reassignment')
  }

  const assignedAt = new Date()

  await prisma.lead.update({
    where: { id: existingLead.id },
    data: {
      bdId: bd.userId,
      bdeName: bd.userName,
      teamLeadId: bd.managerLeadId,
      assignedDate: assignedAt,
    },
  })

  await prisma.incomingLead.update({
    where: { id: incomingLead.id },
    data: {
      selectedTeamLeadUserId: bd.managerUserId,
      selectedTeamLeadEmployeeId: bd.managerEmployeeId,
      selectedBdUserId: bd.userId,
      processedAt: new Date(),
      errorMessage: null,
    },
  })

  await logCrmActivity({
    action: 'CRM_LEAD_REASSIGNED',
    entityType: 'CRM_LEAD',
    entityId: existingLead.id,
    entityLabel: `${existingLead.leadRef} · ${existingLead.patientName}`,
    actorUserId: actor.id,
    actorRole: actor.role,
    route: '/api/crm/incoming-leads/manual-assign',
    method: 'POST',
    summary: `Reassigned lead ${existingLead.leadRef} · ${existingLead.patientName} from ${existingLead.bd?.name ?? 'Unassigned'} to ${bd.userName}`,
    metadata: {
      leadId: existingLead.id,
      leadRef: existingLead.leadRef,
      patientName: existingLead.patientName,
      previousBdId: existingLead.bdId,
      previousBdName: existingLead.bd?.name ?? null,
      nextBdId: bd.userId,
      nextBdName: bd.userName,
      previousAssignedDate: existingLead.assignedDate?.toISOString() ?? null,
      nextAssignedDate: assignedAt.toISOString(),
      incomingLeadId: incomingLead.id,
      automatic: false,
    },
  })

  return {
    incomingLeadId: incomingLead.id,
    status: incomingLead.status === 'DUPLICATE' ? 'duplicate' : 'already_processed',
    leadId: existingLead.id,
    leadRef: existingLead.leadRef,
    bdName: bd.userName,
  }
}

async function processManualAssignedMySQLLead(
  incomingLead: IncomingLeadForManualAssign,
  bd: AssignableUserContext,
  systemUserId: string,
  lookups: LookupMaps
): Promise<ManualAssignResultItem> {
  const mysqlLead = getMySQLLeadFromPayload(incomingLead.payload)
  if (!mysqlLead) {
    const error = 'Stored MySQL payload is missing mysqlLead data.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  const leadRef = String(mysqlLead.id)
  const normalizedPhone =
    incomingLead.normalizedPhone ?? normalizeLeadPhoneToLast10(mysqlLead.Patient_Number)

  if (!normalizedPhone) {
    const error = 'Phone number must contain at least 10 digits.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  const existingLead = await prisma.lead.findUnique({
    where: { leadRef },
    select: { id: true, leadRef: true },
  })

  if (existingLead) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'PROCESSED',
        processedLeadId: existingLead.id,
        selectedTeamLeadUserId: bd.managerUserId,
        selectedTeamLeadEmployeeId: bd.managerEmployeeId,
        selectedBdUserId: bd.userId,
        processedAt: new Date(),
        errorMessage: null,
      },
    })
    return {
      incomingLeadId: incomingLead.id,
      status: 'already_processed',
      leadId: existingLead.id,
      leadRef: existingLead.leadRef,
      bdName: bd.userName,
    }
  }

  const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone)
  if (duplicateLead) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'DUPLICATE',
        processedLeadId: duplicateLead.id,
        normalizedPhone,
        selectedTeamLeadUserId: bd.managerUserId,
        selectedTeamLeadEmployeeId: bd.managerEmployeeId,
        selectedBdUserId: bd.userId,
        processedAt: new Date(),
        errorMessage: `Duplicate phone number. Existing lead: ${duplicateLead.leadRef}. Duplicate count: ${duplicateLead.duplCount}`,
      },
    })
    return {
      incomingLeadId: incomingLead.id,
      status: 'duplicate',
      leadId: duplicateLead.id,
      leadRef: duplicateLead.leadRef,
      bdName: bd.userName,
    }
  }

  const priorIncomingLead = await findLatestPriorIncomingLeadByPrimaryPhone(normalizedPhone, {
    excludeIncomingLeadId: incomingLead.id,
    beforeReceivedAt: incomingLead.receivedAt,
  })
  if (priorIncomingLead && !priorIncomingLead.processedLeadId) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'DUPLICATE',
        normalizedPhone,
        selectedTeamLeadUserId: bd.managerUserId,
        selectedTeamLeadEmployeeId: bd.managerEmployeeId,
        selectedBdUserId: bd.userId,
        processedAt: new Date(),
        errorMessage: `Duplicate phone number. Existing incoming lead: ${priorIncomingLead.id}`,
      },
    })
    return {
      incomingLeadId: incomingLead.id,
      status: 'duplicate',
      bdName: bd.userName,
    }
  }

  const leadData = mapMySQLLeadToPrismaWithoutOwner(mysqlLead, systemUserId, lookups)
  const { updatedDate, ...leadDataWithoutOwner } = leadData

  const createdLead = await prisma.lead.create({
    data: {
      ...leadDataWithoutOwner,
      ...(updatedDate !== null ? { updatedDate } : {}),
      bdId: bd.userId,
      bdeName: bd.userName,
      teamLeadId: bd.managerLeadId,
    },
    select: {
      id: true,
      leadRef: true,
    },
  })

  await prisma.incomingLead.update({
    where: { id: incomingLead.id },
    data: {
      status: 'PROCESSED',
      processedLeadId: createdLead.id,
      selectedTeamLeadUserId: bd.managerUserId,
      selectedTeamLeadEmployeeId: bd.managerEmployeeId,
      selectedBdUserId: bd.userId,
      processedAt: new Date(),
      errorMessage: null,
    },
  })

  return {
    incomingLeadId: incomingLead.id,
    status: 'processed',
    leadId: createdLead.id,
    leadRef: createdLead.leadRef,
    bdName: bd.userName,
  }
}

async function processManualAssignedSaveMyLeadsLead(
  incomingLead: IncomingLeadForManualAssign,
  bd: AssignableUserContext,
  systemUserId: string
): Promise<ManualAssignResultItem> {
  const extracted = extractSaveMyLeadsFields(incomingLead.payload)

  if (!extracted.campaignId) {
    const error = 'campaignId is required.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  if (!extracted.patientName) {
    const error = 'name is required.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  if (!extracted.phone) {
    const error = 'phone is required.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  const normalizedPhone = normalizeLeadPhoneToLast10(extracted.phone)
  if (!normalizedPhone) {
    const error = 'Phone number must contain at least 10 digits.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  const priorIncomingLead = await findLatestPriorIncomingLeadByPrimaryPhone(normalizedPhone, {
    excludeIncomingLeadId: incomingLead.id,
    beforeReceivedAt: incomingLead.receivedAt,
  })
  if (priorIncomingLead && !priorIncomingLead.processedLeadId) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'DUPLICATE',
        normalizedPhone,
        selectedTeamLeadUserId: bd.managerUserId,
        selectedTeamLeadEmployeeId: bd.managerEmployeeId,
        selectedBdUserId: bd.userId,
        processedAt: new Date(),
        errorMessage: `Duplicate phone number. Existing incoming lead: ${priorIncomingLead.id}`,
      },
    })
    return {
      incomingLeadId: incomingLead.id,
      status: 'duplicate',
      bdName: bd.userName,
    }
  }

  const campaign = await loadWebhookCampaign(extracted.campaignId)
  if (!campaign || !campaign.isActive) {
    const error = 'Campaign is not configured or inactive.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        processedAt: new Date(),
      },
    })
    return { incomingLeadId: incomingLead.id, status: 'failed', error }
  }

  const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone)

  if (duplicateLead) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'DUPLICATE',
        externalCampaignId: campaign.externalCampaignId,
        normalizedPhone,
        processedLeadId: duplicateLead.id,
        selectedTeamLeadUserId: bd.managerUserId,
        selectedTeamLeadEmployeeId: bd.managerEmployeeId,
        selectedBdUserId: bd.userId,
        processedAt: new Date(),
        errorMessage: `Duplicate phone number. Existing lead: ${duplicateLead.leadRef}. Duplicate count: ${duplicateLead.duplCount}`,
      },
    })
    return {
      incomingLeadId: incomingLead.id,
      status: 'duplicate',
      leadId: duplicateLead.id,
      leadRef: duplicateLead.leadRef,
      bdName: bd.userName,
    }
  }

  const { month } = getBusinessMonthYear(incomingLead.receivedAt)
  const leadRef = `SML-${campaign.externalCampaignId}-${crypto.randomUUID()}`
  const campaignCircles = getCampaignCircleNames(campaign)

  const cleanStr = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s) return null
    const lower = s.toLowerCase()
    if (['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(lower)) return null
    return s
  }

  const explicitCircle = cleanStr(extracted.circle)
  const finalCircle = explicitCircle ?? (campaignCircles.length === 1 ? campaignCircles[0] : '')
  const finalCategory = cleanStr(extracted.category) ?? cleanStr(campaign.category)
  const finalTreatment = cleanStr(extracted.treatment) ?? cleanStr(campaign.treatment)
  const finalSource = cleanStr(campaign.source.name) ?? cleanStr(extracted.source) ?? 'SaveMyLeads'
  const finalCampaignName =
    cleanStr(campaign.leadSource.name) ??
    cleanStr(campaign.displayName) ??
    cleanStr(extracted.campaignName)

  const lead = await prisma.lead.create({
    data: {
      leadRef,
      patientName: extracted.patientName || 'Unknown',
      age: 0,
      sex: 'Not Specified',
      phoneNumber: extracted.phone || '0000000000',
      status: 'New Lead',
      pipelineStage: PipelineStage.SALES,
      flowType: FlowType.INSURANCE,
      hospitalName: 'Not Specified',
      createdById: systemUserId,
      updatedById: systemUserId,
      createdDate: incomingLead.receivedAt,
      leadEntryDate: incomingLead.receivedAt,
      assignedDate: incomingLead.receivedAt,
      source: finalSource,
      campaignName: finalCampaignName,
      campaignId: campaign.externalCampaignId,
      category: finalCategory,
      treatment: finalTreatment,
      treatmentMasterId: finalTreatment === cleanStr(campaign.treatment) ? (campaign.treatmentMasterId ?? null) : null,
      bdeName: bd.userName,
      bdId: bd.userId,
      teamLeadId: bd.managerLeadId,
      patientEmail: extracted.email || null,
      circle: finalCircle,
      month: `${month}`,
      duplCount: 0,
    },
    select: {
      id: true,
      leadRef: true,
    },
  })

  await prisma.incomingLead.update({
    where: { id: incomingLead.id },
    data: {
      status: 'PROCESSED',
      externalCampaignId: campaign.externalCampaignId,
      normalizedPhone,
      processedLeadId: lead.id,
      selectedTeamLeadUserId: bd.managerUserId,
      selectedTeamLeadEmployeeId: bd.managerEmployeeId,
      selectedBdUserId: bd.userId,
      processedAt: new Date(),
      errorMessage: null,
    },
  })

  return {
    incomingLeadId: incomingLead.id,
    status: 'processed',
    leadId: lead.id,
    leadRef: lead.leadRef,
    bdName: bd.userName,
  }
}

export async function manuallyAssignIncomingLeads(
  incomingLeadIds: string[],
  assigneeUserIds: string[],
  actor: ManualAssignActor
): Promise<ManualAssignIncomingLeadsResult> {
  if (incomingLeadIds.length === 0) {
    throw new Error('Please select at least one incoming lead')
  }

  if (assigneeUserIds.length === 0) {
    throw new Error('Please select at least one assignee')
  }

  const [incomingLeads, assigneeContexts, systemUserId] = await Promise.all([
    prisma.incomingLead.findMany({
      where: {
        id: { in: incomingLeadIds },
      },
      select: {
        id: true,
        source: true,
        status: true,
        payload: true,
        processedLeadId: true,
        externalCampaignId: true,
        normalizedPhone: true,
        receivedAt: true,
      },
    }),
    getAssignableUserContexts(assigneeUserIds),
    getDefaultSystemUserId(),
  ])

  if (incomingLeads.length !== incomingLeadIds.length) {
    throw new Error('One or more selected incoming leads could not be found')
  }

  const orderedAssigneeContexts = assigneeUserIds
    .map((userId) => assigneeContexts.get(userId) ?? null)
    .filter((value): value is AssignableUserContext => Boolean(value))

  if (orderedAssigneeContexts.length === 0) {
    throw new Error('No valid active assignees were selected')
  }

  let mysqlLookupsPromise: Promise<LookupMaps> | null = null
  let processedCount = 0
  let duplicateCount = 0
  let failedCount = 0
  const results: ManualAssignResultItem[] = []

  const orderedIncomingLeads = incomingLeadIds
    .map((id) => incomingLeads.find((incomingLead) => incomingLead.id === id) ?? null)
    .filter((value): value is IncomingLeadForManualAssign => Boolean(value))

  for (const [index, incomingLead] of orderedIncomingLeads.entries()) {
    const bd = orderedAssigneeContexts[index % orderedAssigneeContexts.length]

    if (incomingLead.processedLeadId) {
      const result = await reassignExistingLead(incomingLead, bd, actor)
      if (result.status === 'duplicate') {
        duplicateCount += 1
      } else {
        processedCount += 1
      }
      results.push(result)
      continue
    }

    try {
      let result: ManualAssignResultItem
      if (getMySQLLeadFromPayload(incomingLead.payload)) {
        if (!mysqlLookupsPromise) {
          mysqlLookupsPromise = loadLookupMapsForManualAssign()
        }
        result = await processManualAssignedMySQLLead(
          incomingLead,
          bd,
          systemUserId,
          await mysqlLookupsPromise
        )
      } else {
        result = await processManualAssignedSaveMyLeadsLead(
          incomingLead,
          bd,
          systemUserId
        )
      }

      if (result.status === 'processed' || result.status === 'already_processed') {
        processedCount += 1
      } else if (result.status === 'duplicate') {
        duplicateCount += 1
      } else {
        failedCount += 1
      }

      results.push(result)
    } catch (error) {
      failedCount += 1
      const message =
        error instanceof Error ? error.message : 'Failed to manually assign incoming lead'

      await prisma.incomingLead.update({
        where: { id: incomingLead.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          processedAt: new Date(),
        },
      }).catch(() => null)

      results.push({
        incomingLeadId: incomingLead.id,
        status: 'failed',
        error: message,
      })
    }
  }

  return {
    processedCount,
    duplicateCount,
    failedCount,
    results,
  }
}
