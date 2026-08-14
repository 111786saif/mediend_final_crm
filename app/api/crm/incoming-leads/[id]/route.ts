import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  extractIncomingLeadEditValues,
  extractIncomingLeadSummary,
  getIncomingLeadPayloadRecord,
  toNullableString,
  updateIncomingLeadPayload,
} from '@/lib/crm-incoming-leads'
import {
  getCampaignForWebhook,
  getCampaignCircleNames,
  processSaveMyLeadsIncomingLead,
} from '@/lib/crm-campaigns'
import { hasCrmPermission } from '@/lib/crm-permissions'
import { previewImportedLeadAssignment } from '@/lib/imported-lead-ingestion'
import {
  getDefaultMySQLSystemUserId,
  processMySQLIncomingLead,
} from '@/lib/mysql-incoming-leads'
import { parseFlexibleDateInput } from '@/lib/flexible-date-input'
import { normalizeLeadPhoneToLast10 } from '@/lib/lead-duplicates'
import { getLeadTeamLeadIdForAssigneeManager } from '@/lib/lead-ownership'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { inferPipelineStage, mapMySQLLeadToPrismaWithoutOwner } from '@/lib/sync/mysql-lead-mapper'
import { loadLookupMaps } from '@/lib/sync/mysql-lookup-cache'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const updateIncomingLeadSchema = z.object({
  Lead_Date: z.string().trim().max(50).nullable().optional(),
  Patient_Number: z.string().trim().max(30).nullable().optional(),
  AlternativePhone: z.string().trim().max(30).nullable().optional(),
  Whatsapp: z.string().trim().max(30).nullable().optional(),
  Patient_Name: z.string().trim().max(255).nullable().optional(),
  PatientEmail: z.string().trim().max(255).nullable().optional(),
  Age: z.string().trim().max(10).nullable().optional(),
  Sex: z.string().trim().max(50).nullable().optional(),
  Profession: z.string().trim().max(150).nullable().optional(),
  Circle: z.string().trim().max(100).nullable().optional(),
  city_option: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  ip: z.string().trim().max(100).nullable().optional(),
  Category: z.string().trim().max(100).nullable().optional(),
  Treatment: z.string().trim().max(150).nullable().optional(),
  DiseaseDetails: z.string().trim().max(2000).nullable().optional(),
  Status: z.string().trim().max(100).nullable().optional(),
  SubStatus: z.string().trim().max(25).nullable().optional(),
  MOP: z.string().trim().max(50).nullable().optional(),
  Source: z.string().trim().max(100).nullable().optional(),
  Lead_Source: z.string().trim().max(255).nullable().optional(),
  campaign_id: z.string().trim().max(255).nullable().optional(),
})

function canEditIncomingLeadRole(role: string | null | undefined) {
  return role === 'SUPER_ADMIN' || role === 'CRM_ADMIN'
}

async function canEditIncomingLeads(userId: string, role: string | null | undefined) {
  return canEditIncomingLeadRole(role) || (await hasCrmPermission(userId, 'crm.campaigns.manage'))
}

function normalizeComparableText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function mergeIncomingLeadErrorMessages(...messages: Array<string | null | undefined>) {
  const uniqueMessages: string[] = []

  for (const message of messages) {
    const normalized = message?.trim()
    if (!normalized) continue
    if (uniqueMessages.includes(normalized)) continue
    uniqueMessages.push(normalized)
  }

  return uniqueMessages.length > 0 ? uniqueMessages.join(' | ') : null
}

function parseDate(value: string | null | undefined) {
  return parseFlexibleDateInput(value)
}

function parseAge(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeLeadText(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const lowered = trimmed.toLowerCase()
  if (
    ['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(lowered)
  ) {
    return null
  }
  return trimmed
}

function getMySQLLeadFromPayload(payload: unknown) {
  const { target } = getIncomingLeadPayloadRecord(payload)
  const mysqlLead =
    target.mysqlLead && typeof target.mysqlLead === 'object' && !Array.isArray(target.mysqlLead)
      ? target.mysqlLead
      : null

  return mysqlLead as Record<string, unknown> | null
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

async function buildProcessedLeadUpdateData(params: {
  payload: unknown
  currentUserId: string
  externalCampaignId: string | null
}) {
  const editableValues = extractIncomingLeadEditValues(params.payload, {
    externalCampaignId: params.externalCampaignId,
  })
  const matchedCampaign = params.externalCampaignId
    ? await getCampaignForWebhook(params.externalCampaignId)
    : null
  const campaignCircles = getCampaignCircleNames(matchedCampaign)
  const explicitCircle = normalizeLeadText(editableValues.Circle)
  const explicitCategory = normalizeLeadText(editableValues.Category)
  const explicitTreatment = normalizeLeadText(editableValues.Treatment)
  const explicitSource = normalizeLeadText(editableValues.Source)
  const explicitLeadSource = normalizeLeadText(editableValues.Lead_Source)

  const mysqlLead = getMySQLLeadFromPayload(params.payload)
  const mysqlMapped = mysqlLead
    ? mapMySQLLeadToPrismaWithoutOwner(
        mysqlLead as Parameters<typeof mapMySQLLeadToPrismaWithoutOwner>[0],
        params.currentUserId,
        await loadLookupMaps()
      )
    : null

  const status =
    normalizeLeadText(editableValues.Status) ??
    normalizeLeadText(mysqlMapped?.status as string | null | undefined) ??
    'New Lead'
  const finalCircle =
    explicitCircle ??
    normalizeLeadText(mysqlMapped?.circle as string | null | undefined) ??
    (campaignCircles.length === 1 ? campaignCircles[0] : '')
  const finalCategory =
    explicitCategory ??
    normalizeLeadText(mysqlMapped?.category as string | null | undefined) ??
    normalizeLeadText(matchedCampaign?.category) ??
    null
  const finalTreatment =
    explicitTreatment ??
    normalizeLeadText(mysqlMapped?.treatment as string | null | undefined) ??
    normalizeLeadText(matchedCampaign?.treatment) ??
    null
  const finalSource =
    normalizeLeadText(matchedCampaign?.source?.name) ??
    explicitSource ??
    normalizeLeadText(mysqlMapped?.source as string | null | undefined)
  const finalLeadSource =
    normalizeLeadText(matchedCampaign?.leadSource?.name) ??
    normalizeLeadText(matchedCampaign?.displayName) ??
    explicitLeadSource ??
    normalizeLeadText(mysqlMapped?.campaignName as string | null | undefined)
  const nextLeadEntryDate = parseDate(editableValues.Lead_Date)
  const currentAssignedDate =
    mysqlMapped?.assignedDate instanceof Date ? mysqlMapped.assignedDate : null
  const currentLeadEntryDate =
    mysqlMapped?.leadEntryDate instanceof Date ? mysqlMapped.leadEntryDate : null

  return {
    updateData: {
      patientName: normalizeLeadText(editableValues.Patient_Name) ?? 'Unknown',
      phoneNumber: normalizeLeadText(editableValues.Patient_Number) ?? '0000000000',
      alternateNumber:
        normalizeLeadText(editableValues.AlternativePhone) ??
        normalizeLeadText(mysqlMapped?.alternateNumber as string | null | undefined),
      whatsapp:
        normalizeLeadText(editableValues.Whatsapp) ??
        normalizeLeadText(mysqlMapped?.whatsapp as string | null | undefined),
      patientEmail:
        normalizeLeadText(editableValues.PatientEmail) ??
        normalizeLeadText(mysqlMapped?.patientEmail as string | null | undefined),
      age: parseAge(editableValues.Age),
      sex:
        normalizeLeadText(editableValues.Sex) ??
        normalizeLeadText(mysqlMapped?.sex as string | null | undefined) ??
        'Not Specified',
      profession:
        normalizeLeadText(editableValues.Profession) ??
        normalizeLeadText(mysqlMapped?.profession as string | null | undefined),
      circle: finalCircle,
      address:
        normalizeLeadText(editableValues.address) ??
        normalizeLeadText(mysqlMapped?.address as string | null | undefined),
      website:
        normalizeLeadText(editableValues.website) ??
        normalizeLeadText(mysqlMapped?.website as string | null | undefined),
      category: finalCategory,
      treatment: finalTreatment,
      treatmentMasterId:
        finalTreatment &&
        normalizeLeadText(matchedCampaign?.treatment) === finalTreatment
          ? matchedCampaign?.treatmentMasterId ?? null
          : null,
      diseaseDetails:
        normalizeLeadText(editableValues.DiseaseDetails) ??
        normalizeLeadText(mysqlMapped?.diseaseDetails as string | null | undefined),
      status,
      pipelineStage: inferPipelineStage(status),
      subStatus: normalizeLeadText(editableValues.SubStatus)?.slice(0, 25) ?? null,
      modeOfPayment:
        normalizeLeadText(editableValues.MOP) ??
        normalizeLeadText(mysqlMapped?.modeOfPayment as string | null | undefined),
      source: finalSource,
      campaignName: finalLeadSource,
      campaignId: params.externalCampaignId,
      leadEntryDate: nextLeadEntryDate ?? currentLeadEntryDate,
      updatedById: params.currentUserId,
    },
    assignmentDate: currentAssignedDate,
    routingCircle:
      explicitCircle ??
      normalizeLeadText(mysqlMapped?.circle as string | null | undefined) ??
      normalizeLeadText(editableValues.city_option),
    routingCategory: finalCategory,
  }
}

async function buildResponsePayload(incomingLeadId: string, canViewPhone: boolean) {
  const updated = await prisma.incomingLead.findUnique({
    where: { id: incomingLeadId },
  })

  if (!updated) {
    throw new Error('Incoming lead not found after update')
  }

  const summary = extractIncomingLeadSummary(updated.payload)
  const [campaign, processedLead, teamLead, bd] = await Promise.all([
    updated.externalCampaignId
      ? prisma.crmCampaign.findUnique({
          where: { externalCampaignId: updated.externalCampaignId },
          select: {
            id: true,
            displayName: true,
            externalCampaignId: true,
          },
        })
      : Promise.resolve(null),
    updated.processedLeadId
      ? prisma.lead.findUnique({
          where: { id: updated.processedLeadId },
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
            category: true,
            treatment: true,
            assignedDate: true,
            leadEntryDate: true,
            followUpDate: true,
            surgeryDate: true,
          },
        })
      : Promise.resolve(null),
    updated.selectedTeamLeadUserId
      ? prisma.user.findUnique({
          where: { id: updated.selectedTeamLeadUserId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    updated.selectedBdUserId
      ? prisma.user.findUnique({
          where: { id: updated.selectedBdUserId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
  ])

  return {
    id: updated.id,
    source: updated.source,
    status: updated.status,
    payload: updated.payload,
    externalCampaignId: updated.externalCampaignId,
    normalizedPhone: canViewPhone
      ? updated.normalizedPhone
      : maskPhoneNumber(updated.normalizedPhone),
    errorMessage: updated.errorMessage,
    processedAt: updated.processedAt,
    receivedAt: updated.receivedAt,
    summary: {
      ...summary,
      phone: canViewPhone ? summary.phone : maskPhoneNumber(summary.phone),
    },
    campaign: campaign
      ? {
          id: campaign.id,
          displayName: campaign.displayName,
          externalCampaignId: campaign.externalCampaignId,
        }
      : null,
    processedLead: processedLead
      ? {
          id: processedLead.id,
          leadRef: processedLead.leadRef,
          patientName: processedLead.patientName,
          phoneNumber: canViewPhone
            ? processedLead.phoneNumber
            : maskPhoneNumber(processedLead.phoneNumber),
          category: processedLead.category,
          treatment: processedLead.treatment,
          assignedDate: processedLead.assignedDate,
          leadEntryDate: processedLead.leadEntryDate,
          followUpDate: processedLead.followUpDate,
          surgeryDate: processedLead.surgeryDate,
        }
      : null,
    teamLead: teamLead
      ? {
          id: teamLead.id,
          name: teamLead.name,
          email: teamLead.email,
        }
      : null,
    bd: bd
      ? {
          id: bd.id,
          name: bd.name,
          email: bd.email,
        }
      : null,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) return unauthorizedResponse()

    if (!(await canEditIncomingLeads(currentUser.id, currentUser.role))) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = updateIncomingLeadSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid incoming lead update', 400)
    }

    const existing = await prisma.incomingLead.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        payload: true,
        externalCampaignId: true,
        errorMessage: true,
        normalizedPhone: true,
        processedLeadId: true,
        selectedTeamLeadUserId: true,
        selectedTeamLeadEmployeeId: true,
        selectedBdUserId: true,
        status: true,
        receivedAt: true,
      },
    })

    if (!existing) {
      return errorResponse('Incoming lead not found', 404)
    }

    const normalizedFields = Object.fromEntries(
      Object.entries(parsed.data).map(([key, value]) => [key, toNullableString(value)])
    ) as Record<keyof typeof parsed.data, string | null | undefined>

    if (
      normalizedFields.Patient_Number !== undefined &&
      normalizedFields.Patient_Number !== null &&
      normalizeLeadPhoneToLast10(normalizedFields.Patient_Number) == null
    ) {
      return errorResponse('Phone number must contain at least 10 digits', 400)
    }

    const currentValues = extractIncomingLeadEditValues(existing.payload, {
      externalCampaignId: existing.externalCampaignId,
      source: existing.source,
    })
    const currentCampaignId =
      toNullableString(existing.externalCampaignId) ?? toNullableString(currentValues.campaign_id)
    const currentCircle = toNullableString(currentValues.Circle)
    const nextCampaignId =
      normalizedFields.campaign_id !== undefined
        ? normalizedFields.campaign_id
        : currentCampaignId
    const nextCircle =
      normalizedFields.Circle !== undefined ? normalizedFields.Circle : currentCircle
    const routingChanged =
      normalizeComparableText(nextCampaignId) !== normalizeComparableText(currentCampaignId) ||
      normalizeComparableText(nextCircle) !== normalizeComparableText(currentCircle)

    const nextPayload = updateIncomingLeadPayload(existing.payload, {
      ...normalizedFields,
      source: normalizedFields.Source,
      externalCampaignId: normalizedFields.campaign_id,
      phone: normalizedFields.Patient_Number,
      email: normalizedFields.PatientEmail,
      patientName: normalizedFields.Patient_Name,
      circle: normalizedFields.Circle,
      city: normalizedFields.city_option,
    })

    const nextNormalizedPhone =
      normalizedFields.Patient_Number !== undefined
        ? normalizeLeadPhoneToLast10(normalizedFields.Patient_Number)
        : existing.normalizedPhone

    const canViewPhone = String(currentUser.role) === 'ADMIN'
    const shouldAttemptReprocess =
      !existing.processedLeadId &&
      (existing.status === 'FAILED' || existing.status === 'PENDING' || routingChanged)

    const incomingLeadUpdateData: Record<string, unknown> = {
      payload: nextPayload,
    }

    if (normalizedFields.Source !== undefined) {
      incomingLeadUpdateData.source = normalizedFields.Source
    }
    if (normalizedFields.campaign_id !== undefined) {
      incomingLeadUpdateData.externalCampaignId = normalizedFields.campaign_id
    }
    if (normalizedFields.Patient_Number !== undefined) {
      incomingLeadUpdateData.normalizedPhone = nextNormalizedPhone
    }

    let processedLeadUpdateData: Awaited<
      ReturnType<typeof buildProcessedLeadUpdateData>
    >['updateData'] | null = null

    if (existing.processedLeadId) {
      const processedLeadUpdate = await buildProcessedLeadUpdateData({
        payload: nextPayload,
        currentUserId: currentUser.id,
        externalCampaignId: nextCampaignId ?? null,
      })

      if (routingChanged) {
        const assignmentPreview = await previewImportedLeadAssignment({
          externalCampaignId: nextCampaignId ?? undefined,
          city: processedLeadUpdate.routingCircle ?? null,
          category: processedLeadUpdate.routingCategory ?? null,
          assignmentDate: processedLeadUpdate.assignmentDate ?? new Date(),
        })

        // Allow campaign/circle edits to persist even when the new routing
        // configuration is missing or inactive. In that case we keep the
        // current assignee unchanged instead of blocking the edit.
        if (assignmentPreview.assignment) {
          processedLeadUpdate.updateData.bdId = assignmentPreview.assignment.bd.userId
          processedLeadUpdate.updateData.bdeName = assignmentPreview.assignment.bd.name
          processedLeadUpdate.updateData.teamLeadId =
            await getLeadTeamLeadIdForAssigneeManager(assignmentPreview.assignment.bd.userId)
          incomingLeadUpdateData.selectedTeamLeadUserId =
            assignmentPreview.assignment.teamLead.userId
          incomingLeadUpdateData.selectedTeamLeadEmployeeId =
            assignmentPreview.assignment.teamLead.employeeId
          incomingLeadUpdateData.selectedBdUserId = assignmentPreview.assignment.bd.userId
        } else {
          incomingLeadUpdateData.errorMessage = mergeIncomingLeadErrorMessages(
            existing.errorMessage,
            assignmentPreview.explanation
              ? `Routing note: ${assignmentPreview.explanation}`
              : 'Routing note: No valid CRM assignment was found for the updated campaign/circle.'
          )
        }
      }

      processedLeadUpdateData = processedLeadUpdate.updateData
    }

    await prisma.$transaction(async (tx) => {
      if (existing.processedLeadId && processedLeadUpdateData) {
        await tx.lead.update({
          where: { id: existing.processedLeadId },
          data: processedLeadUpdateData,
        })
      }

      await tx.incomingLead.update({
        where: { id: existing.id },
        data: incomingLeadUpdateData,
      })
    })

    if (shouldAttemptReprocess) {
      const previousErrorMessage = existing.errorMessage
      let reprocessErrorMessage: string | null = null

      if (existing.source === 'mysql' || existing.source === 'manual_mysql') {
        try {
          const queueDeps = {
            systemUserId: await getDefaultMySQLSystemUserId(),
            lookups: await loadLookupMaps(),
            bdMap: await fetchBDUsersMap(),
          }

          await processMySQLIncomingLead(existing.id, queueDeps)
        } catch (error) {
          reprocessErrorMessage =
            error instanceof Error ? error.message : 'Failed to reprocess incoming lead'
          console.error('Error reprocessing CRM incoming lead after edit:', error)
        }
      } else if (existing.source === 'savemyleads') {
        try {
          const extracted = extractSaveMyLeadsFields(nextPayload)

          if (extracted.campaignId && extracted.patientName && extracted.phone) {
            await processSaveMyLeadsIncomingLead({
              incomingLeadId: existing.id,
              externalCampaignId: extracted.campaignId,
              patientName: extracted.patientName,
              phone: extracted.phone,
              email: extracted.email,
              receivedAt: existing.receivedAt,
            })
          }
        } catch (error) {
          reprocessErrorMessage =
            error instanceof Error ? error.message : 'Failed to reprocess incoming lead'
          console.error('Error reprocessing SaveMyLeads incoming lead after edit:', error)
        }
      }

      if (previousErrorMessage) {
        const refreshedIncomingLead = await prisma.incomingLead.findUnique({
          where: { id: existing.id },
          select: { errorMessage: true },
        })

        const mergedErrorMessage = mergeIncomingLeadErrorMessages(
          previousErrorMessage,
          refreshedIncomingLead?.errorMessage,
          reprocessErrorMessage
        )

        if (mergedErrorMessage !== (refreshedIncomingLead?.errorMessage ?? null)) {
          await prisma.incomingLead.update({
            where: { id: existing.id },
            data: {
              errorMessage: mergedErrorMessage,
            },
          })
        }
      }
    }

    return successResponse(await buildResponsePayload(existing.id, canViewPhone))
  } catch (error) {
    console.error('Error updating CRM incoming lead:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to update incoming lead',
      500
    )
  }
}
