import { Prisma } from '@/generated/prisma/client'
import { getLeadTeamLeadIdForAssigneeManager } from '@/lib/lead-ownership'
import { withGeneratedManualLeadRef } from '@/lib/manual-lead-ref'
import { createLeadAssignedNotification } from '@/lib/lead-notifications'
import { prisma } from '@/lib/prisma'
import {
  getCampaignCircleNames,
  getCampaignForWebhook,
  previewCampaignLeadAssignment,
} from '@/lib/crm-campaigns'
import {
  dryRunCrmLeadAssignment,
  type CrmAssignmentDryRunResult,
} from '@/lib/crm-assignment'
import {
  DUPLICATE_LEAD_STATUS,
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'

export type ImportedLeadSource =
  | 'savemyleads'
  | 'mysql'
  | 'csv'
  | 'api'
  | 'webhook'
  | 'manual_mysql'

export type ImportedLeadAssignmentContext = {
  externalCampaignId?: string | null
  city?: string | null
  category?: string | null
  departmentId?: string | null
  assignmentDate?: Date
}

export type ImportedLeadCreateInput = {
  source: ImportedLeadSource
  sourceReference: string
  assignmentContext: ImportedLeadAssignmentContext
  forceDuplicateStatus?: boolean
  generateManualLeadRef?: boolean
  leadData: Omit<Prisma.LeadUncheckedCreateInput, 'bdId' | 'bdeName'> & {
    bdId?: string | null
    bdeName?: string | null
    treatmentMasterId?: string | null
  }
}

export type ImportedLeadIngestionResult = {
  created: boolean
  deduplicated: boolean
  leadId: number
  leadRef: string
  assignmentApplied: boolean
  matchedRule: CrmAssignmentDryRunResult['matchedRule']
  assignment: CrmAssignmentDryRunResult['assignment']
  candidateDiagnostics: CrmAssignmentDryRunResult['candidateDiagnostics']
  explanation: string
  duplicateLeadId?: number
  duplicateLeadRef?: string
  duplicateCount?: number
  normalizedPhone?: string
}

function normalizeImportedLeadString(value: unknown): string | null {
  if (value == null) return null
  const str = String(value).trim()
  if (!str) return null
  const lower = str.toLowerCase()
  if (['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(lower)) {
    return null
  }
  return str
}

function normalizeImportedLeadId(value: unknown): string | null {
  if (value == null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

export async function previewImportedLeadAssignment(
  assignmentContext: ImportedLeadAssignmentContext
) {
  const externalCampaignId = assignmentContext.externalCampaignId?.trim() ?? ''
  if (externalCampaignId) {
    const campaignPreview = await previewCampaignLeadAssignment({
      externalCampaignId,
      preferredCircle: assignmentContext.city ?? null,
      category: assignmentContext.category ?? null,
      assignmentDate: assignmentContext.assignmentDate,
    })

    if (campaignPreview.campaignFound) {
      return {
        ...campaignPreview.result,
        campaignMatched: true,
      }
    }
  }

  return {
    ...(await dryRunCrmLeadAssignment({
    city: assignmentContext.city ?? null,
    category: assignmentContext.category ?? null,
    departmentId: assignmentContext.departmentId ?? null,
    assignmentDate: assignmentContext.assignmentDate,
    })),
    campaignMatched: false,
  }
}

export async function createImportedLeadWithCrmAssignment(
  input: ImportedLeadCreateInput
): Promise<ImportedLeadIngestionResult> {
  const rawPhoneNumber =
    typeof input.leadData.phoneNumber === 'string' ? input.leadData.phoneNumber : null
  const normalizedPhone = normalizeLeadPhoneToLast10(rawPhoneNumber)
  if (!normalizedPhone) {
    throw new Error(
      `Phone number must contain at least 10 digits for ${input.source} lead ${input.sourceReference}.`
    )
  }

  const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(
    normalizedPhone,
    input.leadData.treatment as string | null | undefined
  )
  const isDuplicate = Boolean(duplicateLead) || Boolean(input.forceDuplicateStatus)

  const assignmentResult = await previewImportedLeadAssignment(input.assignmentContext)

  if (!assignmentResult.assignment) {
    throw new Error(
      `CRM auto-assignment failed for ${input.source} lead ${input.sourceReference}: ${assignmentResult.explanation}`
    )
  }

  const { bdId: _ignoredBdId, bdeName: _ignoredBdeName, ...leadDataWithoutOwner } = input.leadData
  void _ignoredBdId
  void _ignoredBdeName
  const externalCampaignId = normalizeImportedLeadString(input.assignmentContext.externalCampaignId)
  const campaign = externalCampaignId ? await getCampaignForWebhook(externalCampaignId) : null

  const campaignCircles = getCampaignCircleNames(campaign)
  const explicitLeadCircle =
    normalizeImportedLeadString(typeof leadDataWithoutOwner.circle === 'string' ? leadDataWithoutOwner.circle : null) ??
    normalizeImportedLeadString(input.assignmentContext.city)

  // Multi-circle rule: If campaign has >1 circles and incoming data has no circle, keep it blank/null. If 1 circle selected, use that circle.
  const leadCircle =
    explicitLeadCircle ??
    (campaignCircles.length === 1 ? campaignCircles[0] : '')

  const leadCategory =
    normalizeImportedLeadString(typeof leadDataWithoutOwner.category === 'string' ? leadDataWithoutOwner.category : null) ??
    normalizeImportedLeadString(input.assignmentContext.category) ??
    campaign?.category ??
    null

  const explicitLeadTreatment =
    normalizeImportedLeadString(
      typeof leadDataWithoutOwner.treatment === 'string' ? leadDataWithoutOwner.treatment : null
    ) ?? null
  const leadTreatment =
    explicitLeadTreatment ??
    campaign?.treatment ??
    null

  const explicitLeadTreatmentMasterId =
    normalizeImportedLeadId(
      typeof leadDataWithoutOwner.treatmentMasterId === 'string'
        ? leadDataWithoutOwner.treatmentMasterId
        : null
    ) ?? null
  const leadTreatmentMasterId =
    explicitLeadTreatmentMasterId ??
    (leadTreatment && campaign?.treatment && leadTreatment === campaign.treatment
      ? campaign.treatmentMasterId ?? null
      : null)

  const leadSource = campaign
    ? campaign.source?.name ?? null
    : normalizeImportedLeadString(
        typeof leadDataWithoutOwner.source === 'string' ? leadDataWithoutOwner.source : null
      ) ?? input.source

  const campaignName = campaign
    ? campaign.leadSource?.name ?? campaign.displayName ?? null
    : normalizeImportedLeadString(
        typeof leadDataWithoutOwner.campaignName === 'string'
          ? leadDataWithoutOwner.campaignName
          : null
      ) ?? null

  const persistedCampaignId =
    normalizeImportedLeadString(typeof leadDataWithoutOwner.campaignId === 'string' ? leadDataWithoutOwner.campaignId : null) ??
    campaign?.externalCampaignId ??
    externalCampaignId
  const teamLeadId = await getLeadTeamLeadIdForAssigneeManager(
    assignmentResult.assignment.bd.userId,
  )
  const leadCreateData = {
    ...leadDataWithoutOwner,
    status: isDuplicate
      ? DUPLICATE_LEAD_STATUS
      : normalizeImportedLeadString(typeof leadDataWithoutOwner.status === 'string' ? leadDataWithoutOwner.status : null) ??
        'New Lead',
    circle: leadCircle,
    category: leadCategory,
    treatment: leadTreatment,
    treatmentMasterId: leadTreatmentMasterId,
    source: leadSource,
    campaignName,
    campaignId: persistedCampaignId,
    duplCount: 0,
    bdId: assignmentResult.assignment.bd.userId,
    bdeName: assignmentResult.assignment.bd.name,
    teamLeadId,
  } as any

  const createLead = (leadRef: string) =>
    prisma.lead.create({
      data: {
        ...leadCreateData,
        leadRef,
      },
      select: {
        id: true,
        leadRef: true,
      },
    })

  const lead = input.generateManualLeadRef
    ? await withGeneratedManualLeadRef(createLead)
    : await createLead(leadDataWithoutOwner.leadRef)

  await createLeadAssignedNotification({
    userId: assignmentResult.assignment.bd.userId,
    patientName: String(leadDataWithoutOwner.patientName || 'Patient'),
    leadRef: lead.leadRef,
    leadId: lead.id,
  })

  return {
    created: true,
    deduplicated: isDuplicate,
    leadId: lead.id,
    leadRef: lead.leadRef,
    assignmentApplied: true,
    matchedRule: assignmentResult.matchedRule,
    assignment: assignmentResult.assignment,
    candidateDiagnostics: assignmentResult.candidateDiagnostics,
    explanation: assignmentResult.explanation,
    duplicateLeadId: duplicateLead?.id,
    duplicateLeadRef: duplicateLead?.leadRef,
    duplicateCount: duplicateLead?.duplCount,
    normalizedPhone,
  }
}

export function stripImportedLeadOwnership<T extends { bdId?: unknown; bdeName?: unknown }>(
  leadData: T
): Omit<T, 'bdId' | 'bdeName'> {
  const { bdId: _bdId, bdeName: _bdeName, ...rest } = leadData
  void _bdId
  void _bdeName
  return rest
}
