import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getCampaignCircleNames,
  getCampaignForWebhook,
  previewCampaignLeadAssignment,
} from '@/lib/crm-campaigns'
import { dryRunCrmLeadAssignment } from '@/lib/crm-assignment'
import {
  normalizeLeadPhoneToLast10,
  recordDuplicateLeadHitByPrimaryPhone,
} from '@/lib/lead-duplicates'

export type ImportedLeadSource =
  | 'savemyleads'
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
  leadData: Omit<Prisma.LeadCreateInput, 'bd' | 'bdeName'> & {
    bdId?: string | null
    bdeName?: string | null
    treatmentMasterId?: string | null
  }
}

export type ImportedLeadIngestionResult = {
  created: boolean
  leadId: string
  leadRef: string
  assignmentApplied: boolean
  matchedRule: unknown
  assignment: unknown
  candidateDiagnostics: unknown
  explanation: string
}

export class DuplicateLeadPhoneError extends Error {
  leadId: string
  leadRef: string
  duplicateCount: number
  normalizedPhone: string

  constructor(params: {
    leadId: string
    leadRef: string
    duplicateCount: number
    normalizedPhone: string
  }) {
    super(`Duplicate lead phone ${params.normalizedPhone}. Existing leadRef: ${params.leadRef}`)
    this.name = 'DuplicateLeadPhoneError'
    this.leadId = params.leadId
    this.leadRef = params.leadRef
    this.duplicateCount = params.duplicateCount
    this.normalizedPhone = params.normalizedPhone
  }
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
      return campaignPreview.result
    }
  }

  return dryRunCrmLeadAssignment({
    city: assignmentContext.city ?? null,
    category: assignmentContext.category ?? null,
    departmentId: assignmentContext.departmentId ?? null,
    assignmentDate: assignmentContext.assignmentDate,
  })
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

  const duplicateLead = await recordDuplicateLeadHitByPrimaryPhone(normalizedPhone)
  if (duplicateLead) {
    throw new DuplicateLeadPhoneError({
      leadId: duplicateLead.id,
      leadRef: duplicateLead.leadRef,
      duplicateCount: duplicateLead.duplCount,
      normalizedPhone,
    })
  }

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

  const lead = await prisma.lead.create({
    data: {
      ...leadDataWithoutOwner,
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
    },
    select: {
      id: true,
      leadRef: true,
    },
  })

  return {
    created: true,
    leadId: lead.id,
    leadRef: lead.leadRef,
    assignmentApplied: true,
    matchedRule: assignmentResult.matchedRule,
    assignment: assignmentResult.assignment,
    candidateDiagnostics: assignmentResult.candidateDiagnostics,
    explanation: assignmentResult.explanation,
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
