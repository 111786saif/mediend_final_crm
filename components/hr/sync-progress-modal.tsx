'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { apiGet } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Database, Clock } from 'lucide-react'

interface SyncJobEmployee {
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

interface SyncJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  employees: SyncJobEmployee[]
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'syncing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

function getOverallProgress(job: SyncJob): number {
  let total = 0
  let done = 0
  for (const emp of job.employees) {
    if (emp.leads.enabled) { total++; if (emp.leads.status === 'done' || emp.leads.status === 'error') done++ }
    if (emp.attendance.enabled) { total++; if (emp.attendance.status === 'done' || emp.attendance.status === 'error') done++ }
  }
  if (total === 0) return 100
  return Math.round((done / total) * 100)
}

interface SyncProgressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string | null
}

export function SyncProgressModal({ open, onOpenChange, jobId }: SyncProgressModalProps) {
  const [job, setJob] = useState<SyncJob | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closedWhileRunning = useRef(false)

  useEffect(() => {
    if (!open || !jobId) return

    closedWhileRunning.current = false

    const poll = async () => {
      try {
        const data = await apiGet<SyncJob>(`/api/employees/sync-status?jobId=${jobId}`)
        setJob(data)
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          if (closedWhileRunning.current) {
            toast.success('Sync completed')
          }
        }
      } catch {
        // Keep polling
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [open, jobId])

  const handleClose = () => {
    if (job?.status === 'running') {
      closedWhileRunning.current = true
      toast.info('Sync continues in background. You will be notified when complete.')
    }
    onOpenChange(false)
  }

  const isRunning = job?.status === 'running'
  const progress = job ? getOverallProgress(job) : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => { if (isRunning) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {isRunning ? 'Syncing Data...' : job?.status === 'completed' ? 'Sync Complete' : 'Sync Status'}
          </DialogTitle>
          <DialogDescription>
            {isRunning
              ? 'Syncing historical leads and attendance data. This may take a few minutes.'
              : job?.status === 'completed'
                ? 'All sync operations have completed.'
                : 'Sync job status'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner */}
        {isRunning && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Please do not close or refresh while syncing is ongoing. You can minimize this dialog and the sync will continue in the background.
            </p>
          </div>
        )}

        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className={cn('h-2', isRunning && 'animate-pulse')} />
        </div>

        {/* Per-employee status */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {job?.employees.map((emp) => (
            <div key={emp.employeeId} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{emp.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{emp.employeeCode}{emp.bdNumber ? ` | CRM #${emp.bdNumber}` : ''}</p>
                </div>
              </div>

              {emp.leads.enabled && (
                <div className="flex items-center gap-3 rounded-md bg-muted/50 p-2">
                  <StatusIcon status={emp.leads.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Leads</p>
                    <p className="text-xs text-muted-foreground">
                      {emp.leads.status === 'pending' && 'Waiting...'}
                      {emp.leads.status === 'syncing' && `${emp.leads.created} created, ${emp.leads.updated} updated...`}
                      {emp.leads.status === 'done' && `${emp.leads.created} created, ${emp.leads.updated} updated`}
                      {emp.leads.status === 'error' && (emp.leads.message || 'Failed')}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-xs',
                    emp.leads.status === 'done' && 'border-emerald-300 text-emerald-700',
                    emp.leads.status === 'error' && 'border-red-300 text-red-700',
                    emp.leads.status === 'syncing' && 'border-blue-300 text-blue-700',
                  )}>
                    {emp.leads.status}
                  </Badge>
                </div>
              )}

              {emp.attendance.enabled && (
                <div className="flex items-center gap-3 rounded-md bg-muted/50 p-2">
                  <StatusIcon status={emp.attendance.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Attendance</p>
                    <p className="text-xs text-muted-foreground">
                      {emp.attendance.status === 'pending' && 'Waiting...'}
                      {emp.attendance.status === 'syncing' && `${emp.attendance.processed}/${emp.attendance.total || '?'} processed...`}
                      {emp.attendance.status === 'done' && `${emp.attendance.processed} processed, ${emp.attendance.skipped} skipped`}
                      {emp.attendance.status === 'error' && (emp.attendance.message || 'Failed')}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-xs',
                    emp.attendance.status === 'done' && 'border-emerald-300 text-emerald-700',
                    emp.attendance.status === 'error' && 'border-red-300 text-red-700',
                    emp.attendance.status === 'syncing' && 'border-blue-300 text-blue-700',
                  )}>
                    {emp.attendance.status}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t pt-3">
          {isRunning ? (
            <Button variant="outline" onClick={handleClose}>
              Minimize (sync continues)
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
