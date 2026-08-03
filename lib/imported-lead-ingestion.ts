import type { Prisma } from '@/generated/prisma/client'
import {
  getCampaignForWebhook,
  previewCampaignLeadAssignment,
} from '@/lib/crm-campaigns'
import { prisma } from '@/lib/prisma'
import {
  dryRunCrmLeadAssignment,
  type CrmAssignmentDryRunResult,
} from '@/lib/crm-assignment'

export type ImportedLeadSource =
  | 'mysql'
  | 'manual_mysql'
  | 'savemyleads'
  | 'incoming_api'

export type ImportedLeadAssignmentContext = {
  externalCampaignId?: string | null
  city?: string | null
  category?: string | null
  departmentId?: string | null
  assignmentDate?: Date
}

export type ImportedLeadCreateData = Omit<
  Prisma.LeadUncheckedCreateInput,
  'bdId' | 'bdeName'
> & {
  bdId?: string | null
  bdeName?: string | null
}

export type ImportedLeadCreateInput = {
  source: ImportedLeadSource
  sourceReference: string
  leadData: ImportedLeadCreateData
  assignmentContext: ImportedLeadAssignmentContext
}

export type ImportedLeadIngestionResult = {
  created: true
  leadId: string
  leadRef: string
  assignmentApplied: boolean
  matchedRule: CrmAssignmentDryRunResult['matchedRule']
  assignment: CrmAssignmentDryRunResult['assignment']
  candidateDiagnostics: CrmAssignmentDryRunResult['candidateDiagnostics']
  explanation: string
}

function normalizeImportedLeadString(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return null
  const lowered = normalized.toLowerCase()
  if (lowered === 'unknown' || lowered === 'not specified') return null
  return normalized
}

function getCampaignDefaultCircleName(
  campaign: Awaited<ReturnType<typeof getCampaignForWebhook>>
) {
  if (!campaign) return null

  const selectedCircleName = campaign.circleSelections.find((selection) => selection.circle?.name)
    ?.circle?.name
  if (selectedCircleName) {
    return selectedCircleName
  }

  return campaign.circle?.name ?? null
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
  const assignmentResult = await previewImportedLeadAssignment(input.assignmentContext)

  if (!assignmentResult.assignment) {
    throw new Error(
      `CRM auto-assignment failed for ${input.source} lead ${input.sourceReference}: ${assignmentResult.explanation}`
    )
  }

  const { bdId: _ignoredBdId, bdeName: _ignoredBdeName, ...leadDataWithoutOwner } = input.leadData
  const externalCampaignId = normalizeImportedLeadString(input.assignmentContext.externalCampaignId)
  const campaign = externalCampaignId ? await getCampaignForWebhook(externalCampaignId) : null
  const preferredCircle =
    normalizeImportedLeadString(input.assignmentContext.city) ??
    normalizeImportedLeadString(
      typeof leadDataWithoutOwner.circle === 'string' ? leadDataWithoutOwner.circle : null
    )
  const fallbackCircle =
    preferredCircle ??
    getCampaignDefaultCircleName(campaign) ??
    (typeof leadDataWithoutOwner.circle === 'string' ? leadDataWithoutOwner.circle : null)
  const campaignCategory =
    normalizeImportedLeadString(input.assignmentContext.category) ??
    campaign?.category ??
    (typeof leadDataWithoutOwner.category === 'string' ? leadDataWithoutOwner.category : null)
  const campaignSource =
    campaign?.source?.name ??
    (typeof leadDataWithoutOwner.source === 'string' ? leadDataWithoutOwner.source : null)
  const campaignName =
    campaign?.leadSource?.name ??
    campaign?.displayName ??
    (typeof leadDataWithoutOwner.campaignName === 'string'
      ? leadDataWithoutOwner.campaignName
      : null)
  const persistedCampaignId =
    campaign?.externalCampaignId ??
    (typeof leadDataWithoutOwner.campaignId === 'string'
      ? normalizeImportedLeadString(leadDataWithoutOwner.campaignId)
      : null) ??
    externalCampaignId

  const lead = await prisma.lead.create({
    data: {
      ...leadDataWithoutOwner,
      circle: fallbackCircle ?? 'Unknown',
      category: campaignCategory,
      source: campaignSource,
      campaignName,
      campaignId: persistedCampaignId,
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
  return rest
}
