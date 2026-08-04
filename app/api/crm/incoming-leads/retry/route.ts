import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getDefaultMySQLSystemUserId,
  processMySQLIncomingLead,
} from '@/lib/mysql-incoming-leads'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { loadLookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { processSaveMyLeadsIncomingLead } from '@/lib/crm-campaigns'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

type RetryIncomingLeadsBody = {
  incomingLeadIds?: unknown
}

type RetryIncomingLeadResultItem = {
  incomingLeadId: string
  status: 'processed' | 'already_processed' | 'failed' | 'skipped'
  leadId?: string
  leadRef?: string
  assignedBdName?: string | null
  error?: string
}

function isSuperAdmin(role: string | null | undefined) {
  return role === 'SUPER_ADMIN'
}

function getPayloadRecord(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  return payload as Record<string, unknown>
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
  const name = record.name ?? record.patientName ?? record.patient_name ?? null
  const phone = record.phone ?? record.phoneNumber ?? record.mobile ?? record.mobileNumber ?? null
  const email = record.email ?? null

  return {
    campaignId: campaignId == null ? null : String(campaignId).trim(),
    patientName: name == null ? null : String(name).trim(),
    phone: phone == null ? null : String(phone).trim(),
    email: email == null ? null : String(email).trim(),
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    if (!isSuperAdmin(String(currentUser.role))) {
      return errorResponse('Forbidden', 403)
    }

    const body = (await request.json()) as RetryIncomingLeadsBody
    const incomingLeadIds = Array.isArray(body.incomingLeadIds)
      ? body.incomingLeadIds.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        )
      : []

    if (incomingLeadIds.length === 0) {
      return errorResponse('Select at least one failed incoming lead to retry', 400)
    }

    const incomingLeads = await prisma.incomingLead.findMany({
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
        receivedAt: true,
      },
    })

    const leadById = new Map(incomingLeads.map((incomingLead) => [incomingLead.id, incomingLead]))
    const orderedIncomingLeads = incomingLeadIds
      .map((incomingLeadId) => leadById.get(incomingLeadId) ?? null)
      .filter((incomingLead): incomingLead is NonNullable<typeof incomingLead> => incomingLead !== null)

    const mysqlLeadIds = orderedIncomingLeads.filter((incomingLead) =>
      incomingLead.source === 'mysql' || incomingLead.source === 'manual_mysql'
    )

    const queueDeps =
      mysqlLeadIds.length > 0
        ? {
            systemUserId: await getDefaultMySQLSystemUserId(),
            lookups: await loadLookupMaps(),
            bdMap: await fetchBDUsersMap(),
          }
        : null

    let processedCount = 0
    let failedCount = 0
    let skippedCount = 0
    const results: RetryIncomingLeadResultItem[] = []

    for (const incomingLead of orderedIncomingLeads) {
      if (incomingLead.status !== 'FAILED') {
        skippedCount += 1
        results.push({
          incomingLeadId: incomingLead.id,
          status: 'skipped',
          error: 'Only failed incoming leads can be retried.',
        })
        continue
      }

      if (incomingLead.processedLeadId) {
        skippedCount += 1
        results.push({
          incomingLeadId: incomingLead.id,
          status: 'already_processed',
          leadId: incomingLead.processedLeadId,
        })
        continue
      }

      try {
        if (incomingLead.source === 'mysql' || incomingLead.source === 'manual_mysql') {
          if (!queueDeps) {
            throw new Error('Retry dependencies for MySQL leads could not be prepared.')
          }

          const result = await processMySQLIncomingLead(incomingLead.id, queueDeps)
          if (result.status === 'failed') {
            failedCount += 1
            results.push({
              incomingLeadId: incomingLead.id,
              status: 'failed',
              error: result.error,
            })
            continue
          }

          processedCount += 1
          results.push({
            incomingLeadId: incomingLead.id,
            status: result.status,
            leadId: result.leadId,
            leadRef: result.leadRef,
            assignedBdName: result.assignedBdName ?? null,
          })
          continue
        }

        if (incomingLead.source === 'savemyleads') {
          const extracted = extractSaveMyLeadsFields(incomingLead.payload)

          if (!extracted.campaignId) {
            throw new Error('campaignId is required.')
          }
          if (!extracted.patientName) {
            throw new Error('name is required.')
          }
          if (!extracted.phone) {
            throw new Error('phone is required.')
          }

          const result = await processSaveMyLeadsIncomingLead({
            incomingLeadId: incomingLead.id,
            externalCampaignId: extracted.campaignId,
            patientName: extracted.patientName,
            phone: extracted.phone,
            email: extracted.email,
            receivedAt: incomingLead.receivedAt,
          })

          processedCount += 1
          results.push({
            incomingLeadId: incomingLead.id,
            status: 'processed',
            leadId: result.leadId,
            leadRef: result.leadRef,
            assignedBdName: result.bd.name,
          })
          continue
        }

        skippedCount += 1
        results.push({
          incomingLeadId: incomingLead.id,
          status: 'skipped',
          error: 'Retry is not supported for this incoming lead source.',
        })
      } catch (error) {
        failedCount += 1
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to retry incoming lead'

        await prisma.incomingLead.update({
          where: { id: incomingLead.id },
          data: {
            status: 'FAILED',
            errorMessage,
            processedAt: new Date(),
          },
        })

        results.push({
          incomingLeadId: incomingLead.id,
          status: 'failed',
          error: errorMessage,
        })
      }
    }

    return successResponse(
      {
        processedCount,
        failedCount,
        skippedCount,
        results,
      },
      `Retried ${processedCount} incoming lead${processedCount === 1 ? '' : 's'}`
    )
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to retry incoming leads',
      400
    )
  }
}
