export interface SyncJobEmployee {
  employeeId: string
  employeeName: string
  employeeCode: string
  bdNumber: number | null
  leads: {
    enabled: boolean
    status: 'pending' | 'syncing' | 'done' | 'error'
    created: number
    updated: number
    errors: number
    message?: string
  }
  attendance: {
    enabled: boolean
    status: 'pending' | 'syncing' | 'done' | 'error'
    processed: number
    skipped: number
    errors: number
    total: number
    message?: string
  }
}

export interface SyncJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  employees: SyncJobEmployee[]
}

const jobs = new Map<string, SyncJob>()

const MAX_JOBS = 100
const JOB_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function cleanup() {
  if (jobs.size <= MAX_JOBS) return
  const now = Date.now()
  for (const [id, job] of jobs) {
    const age = now - new Date(job.startedAt).getTime()
    if (age > JOB_TTL_MS) jobs.delete(id)
  }
}

export function createSyncJob(id: string, employees: SyncJobEmployee[]): SyncJob {
  cleanup()
  const job: SyncJob = {
    id,
    status: 'running',
    startedAt: new Date().toISOString(),
    employees,
  }
  jobs.set(id, job)
  return job
}

export function getSyncJob(id: string): SyncJob | undefined {
  return jobs.get(id)
}

export function updateSyncJob(id: string, updater: (job: SyncJob) => void): void {
  const job = jobs.get(id)
  if (job) updater(job)
}
