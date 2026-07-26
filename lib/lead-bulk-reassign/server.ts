import type { NextRequest } from 'next/server'
import type { SessionUser } from '@/lib/auth'
import { logCrmActivity } from '@/lib/crm-activity'
import {
  buildLeadOwnershipTransferUpdate,
  canUserRemoveLeadRemarks,
  canUserUpdateLeadStatus,
  canUserViewLeadOwner,
  getAssignableLeadUsersForActor,
} from '@/lib/lead-ownership'
import { enqueueLeadBulkReassignCycle } from '@/lib/lead-bulk-reassign/queue'
import type {
  BulkLeadReassignmentRunResponse,
  CreateBulkLeadReassignmentRunInput,
  LeadBulkReassignRunStatus,
} from '@/lib/lead-bulk-reassign/shared'
import { prisma } from '@/lib/prisma'

export class BulkLeadReassignError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'BulkLeadReassignError'
    this.status = status
  }
}

type RunForResponse = {
  id: string
  status: string
  totalLeads: number
  totalBds: number
  pauseSeconds: number
  processedCount: number
  currentLeadIndex: number
  currentBdIndex: number
  currentCycleNumber: number
  removePreviousRemarks: boolean
  subStatus: number | null
  nextRunAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  failedAt: Date | null
  errorMessage: string | null
}

function normalizeOrderedIds(values: string[]) {
  const seen = new Set<string>()
  const ordered: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    ordered.push(trimmed)
  }

  return ordered
}

function parseStoredIdArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not stored correctly`)
  }

  const ids = value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim().length > 0
  )

  if (ids.length !== value.length) {
    throw new Error(`${label} contains invalid values`)
  }

  return ids
}

function normalizeRunStatus(status: string): LeadBulkReassignRunStatus {
  if (
    status === 'queued' ||
    status === 'running' ||
    status === 'waiting' ||
    status === 'completed' ||
    status === 'failed'
  ) {
    return status
  }

  return 'failed'
}

function mapRunToResponse(run: RunForResponse): BulkLeadReassignmentRunResponse {
  return {
    id: run.id,
    jobId: run.id,
    status: normalizeRunStatus(run.status),
    totalLeads: run.totalLeads,
    totalBds: run.totalBds,
    pauseSeconds: run.pauseSeconds,
    processedCount: run.processedCount,
    currentLeadIndex: run.currentLeadIndex,
    currentBdIndex: run.currentBdIndex,
    currentCycleNumber: run.currentCycleNumber,
    removePreviousRemarks: run.removePreviousRemarks,
    subStatus: run.subStatus ?? null,
    nextRunAt: run.nextRunAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    failedAt: run.failedAt?.toISOString() ?? null,
    errorMessage: run.errorMessage ?? null,
  }
}

async function fetchRunForResponse(runId: string) {
  const run = await prisma.bulkLeadReassignmentRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      totalLeads: true,
      totalBds: true,
      pauseSeconds: true,
      processedCount: true,
      currentLeadIndex: true,
      currentBdIndex: true,
      currentCycleNumber: true,
      removePreviousRemarks: true,
      subStatus: true,
      nextRunAt: true,
      startedAt: true,
      completedAt: true,
      failedAt: true,
      errorMessage: true,
    },
  })

  return run ? mapRunToResponse(run) : null
}

export async function getBulkLeadReassignRun(runId: string) {
  return fetchRunForResponse(runId)
}

export async function createBulkLeadReassignmentRun(
  user: SessionUser,
  input: CreateBulkLeadReassignmentRunInput,
  request: NextRequest
) {
  const leadIds = normalizeOrderedIds(input.leadIds)
  const bdUserIds = normalizeOrderedIds(input.bdUserIds)
  const pauseSeconds = Number(input.pauseSeconds)
  const subStatus = input.subStatus

  if (leadIds.length === 0) {
    throw new BulkLeadReassignError('Select at least one lead', 400)
  }

  if (bdUserIds.length === 0) {
    throw new BulkLeadReassignError('Please select at least one BD', 400)
  }

  if (!Number.isInteger(pauseSeconds) || pauseSeconds < 0) {
    throw new BulkLeadReassignError('Pause duration must be zero or greater', 400)
  }

  if (subStatus !== undefined && (!Number.isInteger(subStatus) || subStatus < 0)) {
    throw new BulkLeadReassignError('Sub status must be zero or greater', 400)
  }

  const assignableUsers = (await getAssignableLeadUsersForActor(user)).filter(
    (item) => item.role === 'BD'
  )
  const assignableUserMap = new Map(assignableUsers.map((item) => [item.id, item]))
  const selectedBdUsers = bdUserIds.map((id) => assignableUserMap.get(id))

  if (selectedBdUsers.some((entry) => !entry)) {
    throw new BulkLeadReassignError(
      'You cannot reassign leads to one or more selected BDs',
      403
    )
  }

  const fetchedLeads = await prisma.lead.findMany({
    where: {
      id: {
        in: leadIds,
      },
    },
    select: {
      id: true,
      leadRef: true,
      patientName: true,
      bdId: true,
      bd: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (fetchedLeads.length !== leadIds.length) {
    throw new BulkLeadReassignError(
      'One or more selected leads could not be found',
      404
    )
  }

  const leadMap = new Map(fetchedLeads.map((lead) => [lead.id, lead]))
  const orderedLeads = leadIds.map((leadId) => leadMap.get(leadId))

  if (orderedLeads.some((lead) => !lead)) {
    throw new BulkLeadReassignError(
      'One or more selected leads could not be found',
      404
    )
  }

  for (const lead of orderedLeads) {
    if (!lead) continue

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      throw new BulkLeadReassignError(
        `You do not have access to lead ${lead.leadRef}`,
        403
      )
    }

    if (!(await canUserUpdateLeadStatus(user, lead.bdId))) {
      throw new BulkLeadReassignError(
        `You do not have permission to reassign lead ${lead.leadRef}`,
        403
      )
    }

    if (
      input.removePreviousRemarks &&
      !(await canUserRemoveLeadRemarks(user, lead.bdId))
    ) {
      throw new BulkLeadReassignError(
        `You do not have permission to remove remarks for lead ${lead.leadRef}`,
        403
      )
    }
  }

  const run = await prisma.bulkLeadReassignmentRun.create({
    data: {
      actorUserId: user.id,
      leadIds,
      bdUserIds,
      pauseSeconds,
      subStatus: subStatus ?? null,
      removePreviousRemarks: input.removePreviousRemarks,
      status: 'queued',
      totalLeads: leadIds.length,
      totalBds: bdUserIds.length,
      metadata: {
        leadRefs: orderedLeads.map((lead) => lead?.leadRef ?? null),
        patientNames: orderedLeads.map((lead) => lead?.patientName ?? null),
        bdSelections: selectedBdUsers.map((bd) => ({
          id: bd!.id,
          name: bd!.name,
          role: bd!.role,
        })),
      },
    },
    select: {
      id: true,
    },
  })

  const job = await enqueueLeadBulkReassignCycle(run.id, 1, 0)

  await prisma.bulkLeadReassignmentRun.update({
    where: { id: run.id },
    data: {
      bullJobId: job.id != null ? String(job.id) : null,
    },
  })

  await logCrmActivity({
    action: 'CRM_BULK_LEAD_REASSIGN_RUN_QUEUED',
    entityType: 'CRM_LEAD_BULK_REASSIGN_RUN',
    entityId: run.id,
    entityLabel: `Bulk lead reassignment run ${run.id}`,
    actorUserId: user.id,
    actorRole: user.role,
    request,
    summary: `Queued bulk lead reassignment for ${leadIds.length} leads across ${bdUserIds.length} BDs`,
    metadata: {
      runId: run.id,
      leadIds,
      bdUserIds,
      pauseSeconds,
      removePreviousRemarks: input.removePreviousRemarks,
      subStatus: subStatus ?? null,
    },
  })

  const response = await fetchRunForResponse(run.id)
  if (!response) {
    throw new Error('Failed to load queued bulk reassignment run')
  }

  return response
}

export async function processBulkLeadReassignCycle(
  runId: string,
  jobId?: string | null
) {
  let run = await prisma.bulkLeadReassignmentRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      actorUserId: true,
      leadIds: true,
      bdUserIds: true,
      pauseSeconds: true,
      subStatus: true,
      removePreviousRemarks: true,
      status: true,
      processedCount: true,
      currentLeadIndex: true,
      currentBdIndex: true,
      currentCycleNumber: true,
      totalLeads: true,
      totalBds: true,
      bullJobId: true,
      startedAt: true,
      actorUser: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  })

  if (!run) {
    throw new Error(`Bulk lead reassignment run ${runId} not found`)
  }

  if (run.status === 'completed' || run.status === 'failed') {
    return fetchRunForResponse(runId)
  }

  const leadIds = parseStoredIdArray(run.leadIds, 'leadIds')
  const bdUserIds = parseStoredIdArray(run.bdUserIds, 'bdUserIds')

  if (leadIds.length !== run.totalLeads || bdUserIds.length !== run.totalBds) {
    throw new Error('Bulk lead reassignment run has inconsistent stored data')
  }

  if (run.currentLeadIndex >= leadIds.length) {
    await prisma.bulkLeadReassignmentRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        nextRunAt: null,
        bullJobId: null,
        currentBdIndex: 0,
      },
    })
    return fetchRunForResponse(runId)
  }

  const cycleNumber = run.currentCycleNumber + 1

  await prisma.bulkLeadReassignmentRun.update({
    where: { id: runId },
    data: {
      status: 'running',
      bullJobId: jobId ?? run.bullJobId,
      nextRunAt: null,
      startedAt: run.startedAt ?? new Date(),
      failedAt: null,
      errorMessage: null,
      currentCycleNumber: cycleNumber,
    },
  })

  try {
    const targetUsers = await prisma.user.findMany({
      where: {
        id: {
          in: bdUserIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (targetUsers.length !== bdUserIds.length) {
      throw new Error('One or more selected BDs are no longer available')
    }

    const targetUserMap = new Map(targetUsers.map((entry) => [entry.id, entry]))
    const assignmentsThisCycle = Math.min(
      bdUserIds.length - run.currentBdIndex,
      leadIds.length - run.currentLeadIndex
    )

    for (let offset = 0; offset < assignmentsThisCycle; offset += 1) {
      const leadIndex = run.currentLeadIndex + offset
      const bdIndex = run.currentBdIndex + offset
      const leadId = leadIds[leadIndex]
      const nextOwnerUserId = bdUserIds[bdIndex]
      const nextOwner = targetUserMap.get(nextOwnerUserId)

      if (!nextOwner) {
        throw new Error('A selected BD is no longer available')
      }

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          leadRef: true,
          patientName: true,
          bdId: true,
          bd: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      if (!lead) {
        throw new Error(`Lead ${leadId} could not be found during reassignment`)
      }

      const assignedAt = new Date()
      const nextBdIndex = (bdIndex + 1) % bdUserIds.length

      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            updatedBy: {
              connect: { id: run!.actorUserId },
            },
            updatedDate: assignedAt,
            ...buildLeadOwnershipTransferUpdate(nextOwnerUserId, assignedAt),
            ...(run!.subStatus != null ? { subStatus: run!.subStatus } : {}),
            ...(run!.removePreviousRemarks
              ? {
                  removeRemarks: true,
                  remarksClearedAt: assignedAt,
                }
              : {}),
          },
        })

        await tx.bulkLeadReassignmentRun.update({
          where: { id: runId },
          data: {
            processedCount: {
              increment: 1,
            },
            currentLeadIndex: {
              increment: 1,
            },
            currentBdIndex: nextBdIndex,
          },
        })
      })

      const entityLabel = `${lead.leadRef} · ${lead.patientName}`

      await logCrmActivity({
        action: 'CRM_LEAD_REASSIGNED',
        entityType: 'CRM_LEAD',
        entityId: lead.id,
        entityLabel,
        actorUserId: run.actorUser.id,
        actorRole: run.actorUser.role,
        route: '/workers/lead-bulk-reassign-worker',
        method: 'QUEUE',
        summary: `Lead assigned to ${nextOwner.name}`,
        metadata: {
          leadId: lead.id,
          leadRef: lead.leadRef,
          patientName: lead.patientName,
          previousBdId: lead.bdId,
          previousBdName: lead.bd?.name ?? null,
          nextBdId: nextOwner.id,
          nextBdName: nextOwner.name,
          subStatus: run.subStatus ?? null,
          runId,
          cycleNumber,
        },
      })

      if (run.removePreviousRemarks) {
        await logCrmActivity({
          action: 'CRM_LEAD_REMARKS_HIDDEN_AFTER_REASSIGN',
          entityType: 'CRM_LEAD',
          entityId: lead.id,
          entityLabel,
          actorUserId: run.actorUser.id,
          actorRole: run.actorUser.role,
          route: '/workers/lead-bulk-reassign-worker',
          method: 'QUEUE',
          summary: `Hidden previous remarks after reassignment for ${entityLabel}`,
          metadata: {
            leadId: lead.id,
            leadRef: lead.leadRef,
            patientName: lead.patientName,
            remarksClearedAt: assignedAt.toISOString(),
            runId,
            cycleNumber,
          },
        })
      }
    }

    const updatedRun = await prisma.bulkLeadReassignmentRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        actorUserId: true,
        leadIds: true,
        bdUserIds: true,
        pauseSeconds: true,
        subStatus: true,
        removePreviousRemarks: true,
        status: true,
        processedCount: true,
        currentLeadIndex: true,
        currentBdIndex: true,
        currentCycleNumber: true,
        totalLeads: true,
        totalBds: true,
        bullJobId: true,
        startedAt: true,
        actorUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    })

    if (!updatedRun) {
      throw new Error(`Bulk lead reassignment run ${runId} disappeared`)
    }

    run = updatedRun

    if (run.currentLeadIndex >= run.totalLeads) {
      await prisma.bulkLeadReassignmentRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          nextRunAt: null,
          bullJobId: null,
          currentBdIndex: 0,
        },
      })

      await logCrmActivity({
        action: 'CRM_BULK_LEAD_REASSIGN_RUN_COMPLETED',
        entityType: 'CRM_LEAD_BULK_REASSIGN_RUN',
        entityId: runId,
        entityLabel: `Bulk lead reassignment run ${runId}`,
        actorUserId: run.actorUser.id,
        actorRole: run.actorUser.role,
        route: '/workers/lead-bulk-reassign-worker',
        method: 'QUEUE',
        summary: `Completed bulk lead reassignment for ${run.totalLeads} leads`,
        metadata: {
          runId,
          totalLeads: run.totalLeads,
          totalBds: run.totalBds,
          processedCount: run.processedCount,
        },
      })

      return fetchRunForResponse(runId)
    }

    const delayMs = run.pauseSeconds * 1000
    const nextRunAt = delayMs > 0 ? new Date(Date.now() + delayMs) : null
    const nextCycleNumber = run.currentCycleNumber + 1
    const nextJob = await enqueueLeadBulkReassignCycle(
      runId,
      nextCycleNumber,
      delayMs
    )

    await prisma.bulkLeadReassignmentRun.update({
      where: { id: runId },
      data: {
        status: delayMs > 0 ? 'waiting' : 'queued',
        nextRunAt,
        bullJobId: nextJob.id != null ? String(nextJob.id) : null,
      },
    })

    return fetchRunForResponse(runId)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bulk lead reassignment failed'

    await prisma.bulkLeadReassignmentRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        failedAt: new Date(),
        nextRunAt: null,
        errorMessage: message,
        bullJobId: null,
      },
    })

    await logCrmActivity({
      action: 'CRM_BULK_LEAD_REASSIGN_RUN_FAILED',
      entityType: 'CRM_LEAD_BULK_REASSIGN_RUN',
      entityId: runId,
      entityLabel: `Bulk lead reassignment run ${runId}`,
      actorUserId: run.actorUser.id,
      actorRole: run.actorUser.role,
      route: '/workers/lead-bulk-reassign-worker',
      method: 'QUEUE',
      status: 'FAILED',
      summary: `Bulk lead reassignment failed for run ${runId}`,
      errorMessage: message,
      metadata: {
        runId,
        processedCount: run.processedCount,
        totalLeads: run.totalLeads,
        totalBds: run.totalBds,
      },
    })

    throw error
  }
}
