import { UserRole } from '@/generated/prisma/client'
import {
  createImportedLeadWithCrmAssignment,
  ImportedLeadCreateInput,
  previewImportedLeadAssignment,
} from '@/lib/imported-lead-ingestion'
import { prisma } from '@/lib/prisma'
import {
  mapMySQLLeadToPrisma,
  mapMySQLLeadToPrismaAsyncFallback,
  mapMySQLLeadToPrismaWithoutOwner,
  getMySQLSourceLeadRef,
  type BdMap,
  type MySQLLeadRow,
} from '@/lib/sync/mysql-lead-mapper'
import type { LookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { resolveInboundSubStatus } from '@/lib/sub-status'
import {
  findLatestPriorIncomingLeadByPrimaryPhone,
} from '@/lib/lead-duplicates'

export const MYSQL_INCOMING_SOURCE = 'mysql'
export const MANUAL_MYSQL_INCOMING_SOURCE = 'manual_mysql'
const MYSQL_SHAPED_INCOMING_SOURCES = new Set([
  MYSQL_INCOMING_SOURCE,
  MANUAL_MYSQL_INCOMING_SOURCE,
])

type QueueDeps = {
  systemUserId: string
  lookups: LookupMaps
  bdMap: BdMap
}

function normalizePhoneToLast10(raw: string | null | undefined) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : null
}

function mysqlIncomingExternalRef(leadRef: string, source: string) {
  return `${source}:${leadRef}`
}

function normalizeMySQLCampaignId(value: string | number | null | undefined) {
  const normalized = value == null ? '' : String(value).trim()
  return normalized ? normalized : null
}

function normalizeAssignmentCity(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return null
  const lowered = normalized.toLowerCase()
  if (lowered === 'unknown' || lowered === 'not specified') return null
  return normalized
}

function normalizeOptionalString(value: unknown) {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

function normalizeAssignmentDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function getMySQLIncomingPayloadRecord(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  return payload as Record<string, unknown>
}

function getMySQLLeadFromIncomingPayload(payload: unknown): MySQLLeadRow | null {
  const record = getMySQLIncomingPayloadRecord(payload)
  if (!record) return null
  const rawLead = record.mysqlLead
  if (!rawLead || typeof rawLead !== 'object' || Array.isArray(rawLead)) return null
  return rawLead as MySQLLeadRow
}

export async function getDefaultMySQLSystemUserId() {
  let systemUser = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  })
  if (!systemUser) {
    systemUser = await prisma.user.findFirst({
      select: { id: true },
    })
  }
  if (!systemUser) {
    throw new Error('No users found in system. Cannot process MySQL leads.')
  }
  return systemUser.id
}

export async function queueMySQLIncomingLead(
  mysqlLead: MySQLLeadRow,
  options?: { source?: string }
) {
  const leadRef = getMySQLSourceLeadRef(mysqlLead)
  const source = options?.source ?? MYSQL_INCOMING_SOURCE
  const externalRef = mysqlIncomingExternalRef(leadRef, source)
  const normalizedPhone = normalizePhoneToLast10(mysqlLead.Patient_Number)
  const payload = {
    leadRef,
    mysqlLead,
  }

  const rawCampaignId =
    normalizeMySQLCampaignId(mysqlLead.campaign_id) ??
    normalizeMySQLCampaignId(mysqlLead.Lead_Source) ??
    null

  const campaignIdToStore = rawCampaignId ?? externalRef

  const existing = await prisma.incomingLead.findFirst({
    where: {
      source,
      OR: [
        {
          payload: {
            path: ['leadRef'],
            equals: leadRef,
          },
        },
        // Legacy fallback for rows created before leadRef-based intake matching.
        { externalCampaignId: externalRef },
      ],
    },
    select: {
      id: true,
      status: true,
      processedLeadId: true,
    },
  })

  if (existing) {
    const updated = await prisma.incomingLead.update({
      where: { id: existing.id },
      data: {
        payload,
        normalizedPhone,
        externalCampaignId: campaignIdToStore,
      },
      select: {
        id: true,
        status: true,
        processedLeadId: true,
      },
    })
    return updated
  }

  return prisma.incomingLead.create({
    data: {
      source,
      payload,
      status: 'PENDING',
      externalCampaignId: campaignIdToStore,
      normalizedPhone,
    },
    select: {
      id: true,
      status: true,
      processedLeadId: true,
    },
  })
}

export async function processMySQLIncomingLead(
  incomingLeadId: string,
  deps: QueueDeps
) {
  const incomingLead = await prisma.incomingLead.findUnique({
    where: { id: incomingLeadId },
    select: {
      id: true,
      source: true,
      payload: true,
      processedLeadId: true,
      externalCampaignId: true,
      normalizedPhone: true,
      receivedAt: true,
    },
  })

  if (!incomingLead || !MYSQL_SHAPED_INCOMING_SOURCES.has(incomingLead.source ?? '')) {
    throw new Error('MySQL-shaped incoming lead not found')
  }

  if (incomingLead.processedLeadId) {
    const existingLead = await prisma.lead.findUnique({
      where: { id: incomingLead.processedLeadId },
      select: { leadRef: true, bdeName: true },
    })
    return {
      status: 'already_processed' as const,
      leadId: incomingLead.processedLeadId,
      leadRef: existingLead?.leadRef,
      assignedBdName: existingLead?.bdeName ?? null,
    }
  }

  const mysqlLead = getMySQLLeadFromIncomingPayload(incomingLead.payload)
  if (!mysqlLead) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage: 'Stored MySQL payload is missing mysqlLead data.',
        processedAt: new Date(),
      },
    })
    return { status: 'failed' as const, error: 'Stored MySQL payload is missing mysqlLead data.' }
  }

  const sourceLeadRef = getMySQLSourceLeadRef(mysqlLead)
  const normalizedPhone =
    incomingLead.normalizedPhone ?? normalizePhoneToLast10(mysqlLead.Patient_Number)
  const mysqlCampaignId =
    normalizeMySQLCampaignId(mysqlLead.campaign_id) ??
    normalizeMySQLCampaignId(mysqlLead.Lead_Source) ??
    (incomingLead.externalCampaignId && !incomingLead.externalCampaignId.includes(':')
      ? incomingLead.externalCampaignId
      : null)
  const sourceLabel =
    incomingLead.source === MANUAL_MYSQL_INCOMING_SOURCE
      ? MANUAL_MYSQL_INCOMING_SOURCE
      : MYSQL_INCOMING_SOURCE

  const existingLead =
    incomingLead.source === MANUAL_MYSQL_INCOMING_SOURCE
      ? null
      : await prisma.lead.findUnique({
          where: { leadRef: sourceLeadRef },
          select: { id: true, bdeName: true },
        })

  if (existingLead) {
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'PROCESSED',
        processedLeadId: existingLead.id,
        externalCampaignId: mysqlCampaignId ?? incomingLead.externalCampaignId,
        processedAt: new Date(),
        errorMessage: null,
      },
    })
    console.log(
      `[mysql-sync] leadRef=${sourceLeadRef} already exists, linked to BD=${existingLead.bdeName ?? 'Unknown'}`
    )
    return {
      status: 'processed' as const,
      leadId: existingLead.id,
      leadRef: sourceLeadRef,
      assignedBdName: existingLead.bdeName ?? null,
    }
  }

  if (!normalizedPhone) {
    const errorMessage = 'Phone number must contain at least 10 digits.'
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        externalCampaignId: mysqlCampaignId ?? incomingLead.externalCampaignId,
        errorMessage,
        processedAt: new Date(),
      },
    })
    return { status: 'failed' as const, error: errorMessage }
  }

  const priorIncomingLead = await findLatestPriorIncomingLeadByPrimaryPhone(normalizedPhone, {
    excludeIncomingLeadId: incomingLead.id,
    beforeReceivedAt: incomingLead.receivedAt,
  })
  const hasPriorIncomingDuplicate = Boolean(
    priorIncomingLead && !priorIncomingLead.processedLeadId
  )
  const duplicateIncomingLeadId =
    incomingLead.source === MYSQL_INCOMING_SOURCE && hasPriorIncomingDuplicate
      ? priorIncomingLead?.id ?? null
      : null
  const assignedAt = new Date()

  const leadData =
    mapMySQLLeadToPrisma(mysqlLead, deps.systemUserId, deps.lookups, deps.bdMap) ??
    (await mapMySQLLeadToPrismaAsyncFallback(mysqlLead, deps.systemUserId, deps.lookups, false)) ??
    mapMySQLLeadToPrismaWithoutOwner(mysqlLead, deps.systemUserId, deps.lookups)
  const resolvedSubStatus = await resolveInboundSubStatus(mysqlLead.SubStatus)
  if (resolvedSubStatus !== null || leadData.subStatus != null) {
    leadData.subStatus = resolvedSubStatus
  }
  const rawCity =
    typeof mysqlLead.Circle === 'string' && mysqlLead.Circle.trim()
      ? mysqlLead.Circle.trim()
      : typeof mysqlLead.city_option === 'string' && mysqlLead.city_option.trim()
        ? mysqlLead.city_option.trim()
        : null
  const assignmentCity =
    normalizeAssignmentCity(normalizeOptionalString(leadData.circle)) ??
    normalizeAssignmentCity(rawCity)
  const assignmentCategory = normalizeOptionalString(leadData.category)
  const assignmentDate =
    incomingLead.source === MANUAL_MYSQL_INCOMING_SOURCE
      ? assignedAt
      : normalizeAssignmentDate(leadData.assignedDate) ??
        normalizeAssignmentDate(leadData.createdDate) ??
        assignedAt

  const assignmentPreview = await previewImportedLeadAssignment({
    externalCampaignId: mysqlCampaignId,
    city: assignmentCity,
    category: assignmentCategory,
    assignmentDate,
  })

  if (!assignmentPreview.assignment) {
    const shouldBucket =
      incomingLead.source === MYSQL_INCOMING_SOURCE &&
      assignmentPreview.campaignMatched &&
      assignmentPreview.campaignActive !== false
    const errorMessage = `CRM auto-assignment failed for ${sourceLabel} lead ${sourceLeadRef}: ${assignmentPreview.explanation}`
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: duplicateIncomingLeadId ? 'DUPLICATE' : shouldBucket ? 'BUCKET' : 'FAILED',
        errorMessage: duplicateIncomingLeadId
          ? `Duplicate phone number. Existing incoming lead: ${duplicateIncomingLeadId}`
          : errorMessage,
        processedAt: new Date(),
        selectedTeamLeadUserId: null,
        selectedTeamLeadEmployeeId: null,
        selectedBdUserId: null,
      },
    })
    if (duplicateIncomingLeadId) {
      return {
        status: 'duplicate' as const,
        leadId: undefined,
        leadRef: undefined,
        assignedBdName: null,
      }
    }
    return { status: shouldBucket ? ('bucketed' as const) : ('failed' as const), error: errorMessage }
  }

  if (
    incomingLead.source === MYSQL_INCOMING_SOURCE &&
    assignmentPreview.campaignMatched &&
    assignmentPreview.requiresManualAssignment
  ) {
    const errorMessage = `Campaign matched, but no BD is available for assignment: ${assignmentPreview.explanation}`
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: duplicateIncomingLeadId ? 'DUPLICATE' : 'BUCKET',
        errorMessage: duplicateIncomingLeadId
          ? `Duplicate phone number. Existing incoming lead: ${duplicateIncomingLeadId}`
          : errorMessage,
        processedAt: new Date(),
        selectedTeamLeadUserId: assignmentPreview.assignment.teamLead?.userId ?? null,
        selectedTeamLeadEmployeeId: assignmentPreview.assignment.teamLead?.employeeId ?? null,
        selectedBdUserId: null,
      },
    })
    if (duplicateIncomingLeadId) {
      return {
        status: 'duplicate' as const,
        leadId: undefined,
        leadRef: undefined,
        assignedBdName: null,
      }
    }
    return { status: 'bucketed' as const, error: errorMessage }
  }

  const { updatedDate, ...leadDataForCreate } = leadData
  const createInput: ImportedLeadCreateInput = {
    source: sourceLabel,
    sourceReference: sourceLeadRef,
    forceDuplicateStatus: hasPriorIncomingDuplicate,
    generateManualLeadRef: incomingLead.source === MANUAL_MYSQL_INCOMING_SOURCE,
    assignmentContext: {
      externalCampaignId: mysqlCampaignId,
      city: assignmentCity,
      category: assignmentCategory,
      assignmentDate,
    },
    leadData: {
      ...leadDataForCreate,
      ...(incomingLead.source === MANUAL_MYSQL_INCOMING_SOURCE
        ? { assignedDate: assignedAt }
        : {}),
      ...(updatedDate !== null && { updatedDate }),
    },
  }

  const result = await createImportedLeadWithCrmAssignment(createInput)

  const isDuplicate = result.deduplicated
  const duplicateErrorMessage = result.duplicateLeadRef
    ? `Duplicate phone number. Existing lead: ${result.duplicateLeadRef}. Duplicate count: ${result.duplicateCount ?? 0}`
    : hasPriorIncomingDuplicate && priorIncomingLead
      ? `Duplicate phone number. Existing incoming lead: ${priorIncomingLead.id}`
      : null

  await prisma.incomingLead.update({
    where: { id: incomingLead.id },
    data: {
      status: isDuplicate ? 'DUPLICATE' : 'PROCESSED',
      processedLeadId: result.leadId,
      externalCampaignId: mysqlCampaignId ?? incomingLead.externalCampaignId,
      selectedTeamLeadUserId: result.assignment?.teamLead?.userId ?? null,
      selectedTeamLeadEmployeeId: result.assignment?.teamLead?.employeeId ?? null,
      selectedBdUserId: result.assignment?.bd.userId ?? null,
      normalizedPhone: result.normalizedPhone ?? normalizedPhone,
      processedAt: assignedAt,
      errorMessage: duplicateErrorMessage,
    },
  })

  console.log(
    `[mysql-sync] leadRef=${sourceLeadRef} created from queue, assigned BD=${result.assignment?.bd.name ?? 'Unknown'}`
  )

  return {
    status: isDuplicate ? ('duplicate' as const) : ('processed' as const),
    leadId: result.leadId,
    leadRef: result.leadRef,
    assignedBdName: result.assignment?.bd.name ?? null,
  }
}

export async function processQueuedMySQLIncomingLeads(
  deps: QueueDeps,
  limit = 100
) {
  const queue = await prisma.incomingLead.findMany({
    where: {
      source: { in: Array.from(MYSQL_SHAPED_INCOMING_SOURCES) },
      status: { in: ['PENDING', 'FAILED', 'BUCKET'] },
      processedLeadId: null,
    },
    orderBy: { receivedAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  let processed = 0
  let failed = 0
  let bucketed = 0

  for (const item of queue) {
    try {
      const result = await processMySQLIncomingLead(item.id, deps)
      if (result.status === 'processed') processed++
      else if (result.status === 'failed') failed++
      else if (result.status === 'bucketed') bucketed++
    } catch {
      failed++
    }
  }

  return {
    queued: queue.length,
    processed,
    failed,
    bucketed,
  }
}
