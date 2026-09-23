import { Prisma } from '@/generated/prisma/client'
import pLimit from 'p-limit'
import { dryRunCrmLeadAssignment } from '@/lib/crm-assignment'
import { prisma } from '@/lib/prisma'

const PREVIEW_LOG_CONCURRENCY = 5

export const CRM_ASSIGNMENT_PREVIEW_SOURCES = {
  MYSQL_SYNC_SCRIPT: 'mysql_sync_script',
  MYSQL_SYNC_API: 'mysql_sync_api',
  MYSQL_SYNC_DAILY: 'mysql_sync_daily',
  MYSQL_SYNC_EMPLOYEE: 'mysql_sync_employee',
} as const

type CrmAssignmentPreviewSource =
  (typeof CRM_ASSIGNMENT_PREVIEW_SOURCES)[keyof typeof CRM_ASSIGNMENT_PREVIEW_SOURCES]

type LeadPreviewSeed = {
  id: number
  leadRef: string
  bdId: string
  bdeName: string | null
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function fetchLeadSeeds(leadRefs: string[]): Promise<LeadPreviewSeed[]> {
  if (leadRefs.length === 0) return []

  const uniqueLeadRefs = [...new Set(leadRefs)]
  const leads = await prisma.lead.findMany({
    where: {
      leadRef: {
        in: uniqueLeadRefs,
      },
    },
    select: {
      id: true,
      leadRef: true,
      bdId: true,
      bdeName: true,
    },
  })

  return leads
}

export async function logCrmAssignmentPreviewsForLeadRefs(
  leadRefs: string[],
  syncSource: CrmAssignmentPreviewSource
): Promise<{ logged: number; errors: number }> {
  const leads = await fetchLeadSeeds(leadRefs)
  if (leads.length === 0) {
    return { logged: 0, errors: 0 }
  }

  const limit = pLimit(PREVIEW_LOG_CONCURRENCY)
  let logged = 0
  let errors = 0

  await Promise.allSettled(
    leads.map((lead) =>
      limit(async () => {
        try {
          const result = await dryRunCrmLeadAssignment({ leadId: lead.id })
          const assignment = result.assignment

          await prisma.crmAssignmentPreviewLog.create({
            data: {
              leadId: lead.id,
              leadRef: lead.leadRef,
              syncSource,
              currentBdUserId: lead.bdId,
              currentBdName: lead.bdeName,
              matchedRuleId: result.matchedRule?.id ?? null,
              matchedRuleName: result.matchedRule?.name ?? null,
              matchedRuleStrategy: result.matchedRule?.strategy ?? null,
              proposedBdUserId: assignment?.bd.userId ?? null,
              proposedBdEmployeeId: assignment?.bd.employeeId ?? null,
              proposedBdName: assignment?.bd.name ?? null,
              proposedTeamLeadUserId: assignment?.teamLead?.userId ?? null,
              proposedTeamLeadEmployeeId: assignment?.teamLead?.employeeId ?? null,
              proposedTeamLeadName: assignment?.teamLead?.name ?? null,
              proposedSalesHeadUserId: assignment?.salesHead?.userId ?? null,
              proposedSalesHeadEmployeeId: assignment?.salesHead?.employeeId ?? null,
              proposedSalesHeadName: assignment?.salesHead?.name ?? null,
              isMatched: result.matchedRule !== null,
              wouldReassignBd: assignment?.bd.userId ? assignment.bd.userId !== lead.bdId : false,
              assignmentDate: new Date(result.input.assignmentDate),
              explanation: result.explanation,
              inputSnapshot: toJsonValue(result.input),
              assignmentSnapshot: assignment ? toJsonValue(assignment) : undefined,
              candidateDiagnostics: toJsonValue(result.candidateDiagnostics),
            },
          })

          logged++
        } catch (error) {
          errors++
          console.error(`[crm-assignment-preview] Failed to log preview for leadRef ${lead.leadRef}:`, error)
        }
      })
    )
  )

  return { logged, errors }
}
