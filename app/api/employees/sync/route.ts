import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { createSyncJob, updateSyncJob, type SyncJobEmployee } from '@/lib/sync/sync-job-store'

const syncSchema = z.object({
  employees: z.array(z.object({
    employeeId: z.string(),
    syncLeads: z.boolean().default(false),
    syncAttendance: z.boolean().default(false),
  })).min(1),
})

export async function POST(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()
    if (!hasPermission(sessionUser, 'users:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const { employees: syncRequests } = syncSchema.parse(body)

    const employeeRecords = await prisma.employee.findMany({
      where: { id: { in: syncRequests.map((e) => e.employeeId) } },
      include: { user: { select: { name: true } } },
    })

    const employeeMap = new Map(employeeRecords.map((e) => [e.id, e]))

    const jobId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const jobEmployees: SyncJobEmployee[] = syncRequests.map((req) => {
      const emp = employeeMap.get(req.employeeId)
      return {
        employeeId: req.employeeId,
        employeeName: emp?.user?.name ?? 'Unknown',
        employeeCode: emp?.employeeCode ?? '',
        bdNumber: emp?.bdNumber ?? null,
        leads: {
          enabled: req.syncLeads && (emp?.bdNumber ?? null) !== null,
          status: 'pending' as const,
          created: 0,
          updated: 0,
          errors: 0,
        },
        attendance: {
          enabled: req.syncAttendance,
          status: 'pending' as const,
          processed: 0,
          skipped: 0,
          errors: 0,
          total: 0,
        },
      }
    })

    createSyncJob(jobId, jobEmployees)

    // Fire and forget -- run sync in background
    runSyncInBackground(jobId).catch((err) => {
      console.error('[sync] Background sync failed:', err)
      updateSyncJob(jobId, (job) => { job.status = 'failed' })
    })

    return successResponse({ jobId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error starting sync:', error)
    return errorResponse('Failed to start sync', 500)
  }
}

async function runSyncInBackground(jobId: string) {
  const { getSyncJob } = await import('@/lib/sync/sync-job-store')
  const { syncLeadsForEmployee } = await import('@/lib/sync/sync-leads-for-employee')
  const { syncAttendanceForEmployee } = await import('@/lib/sync/sync-attendance-for-employee')
  const { closeMySQLPool } = await import('@/lib/mysql-source-client')

  const job = getSyncJob(jobId)
  if (!job) return

  try {
    for (const emp of job.employees) {
      if (emp.leads.enabled && emp.bdNumber) {
        emp.leads.status = 'syncing'
        try {
          const result = await syncLeadsForEmployee(
            emp.employeeId,
            emp.employeeName,
            emp.bdNumber,
            '2025-01-01',
            (p) => {
              emp.leads.created = p.created
              emp.leads.updated = p.updated
              emp.leads.errors = p.errors
            }
          )
          emp.leads.status = result.status === 'done' ? 'done' : 'error'
          emp.leads.created = result.created
          emp.leads.updated = result.updated
          emp.leads.errors = result.errors
          emp.leads.message = result.message
        } catch (err) {
          emp.leads.status = 'error'
          emp.leads.message = err instanceof Error ? err.message : 'Unknown error'
        }
      }

      if (emp.attendance.enabled && emp.employeeCode) {
        emp.attendance.status = 'syncing'
        try {
          const result = await syncAttendanceForEmployee(
            emp.employeeId,
            emp.employeeName,
            emp.employeeCode,
            '2026-01-01',
            (p) => {
              emp.attendance.processed = p.processed
              emp.attendance.skipped = p.skipped
              emp.attendance.errors = p.errors
              emp.attendance.total = p.total
            }
          )
          emp.attendance.status = result.status === 'done' ? 'done' : 'error'
          emp.attendance.processed = result.processed
          emp.attendance.skipped = result.skipped
          emp.attendance.errors = result.errors
          emp.attendance.total = result.total
          emp.attendance.message = result.message
        } catch (err) {
          emp.attendance.status = 'error'
          emp.attendance.message = err instanceof Error ? err.message : 'Unknown error'
        }
      }
    }

    updateSyncJob(jobId, (j) => {
      j.status = 'completed'
      j.completedAt = new Date().toISOString()
    })
  } catch (err) {
    console.error('[sync] Background sync error:', err)
    updateSyncJob(jobId, (j) => {
      j.status = 'failed'
      j.completedAt = new Date().toISOString()
    })
  } finally {
    try { await closeMySQLPool() } catch {}
  }
}
