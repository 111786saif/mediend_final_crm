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
  type BdMap,
  type MySQLLeadRow,
} from '@/lib/sync/mysql-lead-mapper'
import type { LookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { resolveInboundSubStatus } from '@/lib/sub-status'
import { DuplicateLeadPhoneError } from '@/lib/lead-duplicates'

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

function normalizeMySQLCampaignId(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeAssignmentCity(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return null
  const lowered = normalized.toLowerCase()
  if (lowered === 'unknown' || lowered === 'not specified') return null
  return normalized
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
  const leadRef = String(mysqlLead.id)
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

  const leadRef = String(mysqlLead.id)
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

  const existingLead = await prisma.lead.findUnique({
    where: { leadRef },
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
      `[mysql-sync] leadRef=${leadRef} already exists, linked to BD=${existingLead.bdeName ?? 'Unknown'}`
    )
    return {
      status: 'processed' as const,
      leadId: existingLead.id,
      leadRef: leadRef,
      assignedBdName: existingLead.bdeName ?? null,
    }
  }

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
  const assignmentCity = normalizeAssignmentCity(leadData.circle) ?? normalizeAssignmentCity(rawCity)

  const assignmentPreview = await previewImportedLeadAssignment({
    externalCampaignId: mysqlCampaignId,
    city: assignmentCity,
    category: leadData.category ?? null,
    assignmentDate: leadData.assignedDate ?? leadData.createdDate,
  })

  if (!assignmentPreview.assignment) {
    const errorMessage = `CRM auto-assignment failed for ${sourceLabel} lead ${leadRef}: ${assignmentPreview.explanation}`
    await prisma.incomingLead.update({
      where: { id: incomingLead.id },
      data: {
        status: 'FAILED',
        errorMessage,
        processedAt: new Date(),
        selectedTeamLeadUserId: assignmentPreview.assignment?.teamLead?.userId ?? null,
        selectedTeamLeadEmployeeId: assignmentPreview.assignment?.teamLead?.employeeId ?? null,
        selectedBdUserId: assignmentPreview.assignment?.bd.userId ?? null,
      },
    })
    return { status: 'failed' as const, error: errorMessage }
  }

  const { updatedDate, ...leadDataForCreate } = leadData
  const createInput: ImportedLeadCreateInput = {
    source: sourceLabel,
    sourceReference: leadRef,
    assignmentContext: {
      externalCampaignId: mysqlCampaignId,
      city: assignmentCity,
      category: leadData.category ?? null,
      assignmentDate: leadData.assignedDate ?? leadData.createdDate,
    },
    leadData: {
      ...leadDataForCreate,
      ...(updatedDate !== null && { updatedDate }),
    },
  }

  let result
  try {
    result = await createImportedLeadWithCrmAssignment(createInput)
  } catch (error) {
    if (error instanceof DuplicateLeadPhoneError) {
      await prisma.incomingLead.update({
        where: { id: incomingLead.id },
        data: {
          status: 'DUPLICATE',
          processedLeadId: error.leadId,
          externalCampaignId: mysqlCampaignId ?? incomingLead.externalCampaignId,
          selectedTeamLeadUserId: null,
          selectedTeamLeadEmployeeId: null,
          selectedBdUserId: null,
          normalizedPhone: error.normalizedPhone,
          processedAt: new Date(),
          errorMessage: `Duplicate phone number. Existing lead: ${error.leadRef}. Duplicate count: ${error.duplicateCount}`,
        },
      })

      return {
        status: 'duplicate' as const,
        leadId: error.leadId,
        leadRef: error.leadRef,
        assignedBdName: null,
      }
    }
    throw error
  }

  await prisma.incomingLead.update({
    where: { id: incomingLead.id },
    data: {
      status: 'PROCESSED',
      processedLeadId: result.leadId,
      externalCampaignId: mysqlCampaignId ?? incomingLead.externalCampaignId,
      selectedTeamLeadUserId: result.assignment?.teamLead?.userId ?? null,
      selectedTeamLeadEmployeeId: result.assignment?.teamLead?.employeeId ?? null,
      selectedBdUserId: result.assignment?.bd.userId ?? null,
      processedAt: new Date(),
      errorMessage: null,
    },
  })

  console.log(
    `[mysql-sync] leadRef=${leadRef} created from queue, assigned BD=${result.assignment?.bd.name ?? 'Unknown'}`
  )

  return {
    status: 'processed' as const,
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
      status: { in: ['PENDING', 'FAILED'] },
      processedLeadId: null,
    },
    orderBy: { receivedAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  let processed = 0
  let failed = 0

  for (const item of queue) {
    try {
      const result = await processMySQLIncomingLead(item.id, deps)
      if (result.status === 'processed') processed++
      else if (result.status === 'failed') failed++
    } catch {
      failed++
    }
  }

  return {
    queued: queue.length,
    processed,
    failed,
  }
}
