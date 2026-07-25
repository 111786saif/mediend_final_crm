import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  BulkLeadReassignError,
  createBulkLeadReassignmentRun,
} from '@/lib/lead-bulk-reassign/server'
import type { CreateBulkLeadReassignmentRunInput } from '@/lib/lead-bulk-reassign/shared'
import { getAssignableLeadUsersForActor } from '@/lib/lead-ownership'
import { hasPermission } from '@/lib/rbac'
import { getSessionFromRequest } from '@/lib/session'

export const runtime = 'nodejs'

type BulkReassignBody = {
  leadIds?: unknown
  bdUserIds?: unknown
  pauseSeconds?: unknown
  removePreviousRemarks?: unknown
  subStatus?: unknown
}

function parseOptionalInteger(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error('Please enter a valid whole number')
  }

  return parsed
}

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) {
    return unauthorizedResponse()
  }

  if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
    return errorResponse('Forbidden', 403)
  }

  const assignableUsers = await getAssignableLeadUsersForActor(user)

  return successResponse({
    canBulkReassign: assignableUsers.length > 0,
    assignableUsers,
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = (await request.json()) as BulkReassignBody
    const subStatus = parseOptionalInteger(body.subStatus)
    const payload: CreateBulkLeadReassignmentRunInput = {
      leadIds: Array.isArray(body.leadIds)
        ? body.leadIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0
          )
        : [],
      bdUserIds: Array.isArray(body.bdUserIds)
        ? body.bdUserIds.filter(
            (value): value is string =>
              typeof value === 'string' && value.trim().length > 0
          )
        : [],
      pauseSeconds: parseOptionalInteger(body.pauseSeconds) ?? 0,
      removePreviousRemarks: body.removePreviousRemarks === true,
      ...(subStatus !== undefined ? { subStatus } : {}),
    }

    const run = await createBulkLeadReassignmentRun(user, payload, request)

    return successResponse(
      run,
      `Queued bulk reassignment for ${run.totalLeads} lead${run.totalLeads === 1 ? '' : 's'}`
    )
  } catch (error) {
    console.error('POST /api/leads/bulk-reassign', error)
    if (error instanceof BulkLeadReassignError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Failed to queue bulk reassignment',
      500
    )
  }
}
