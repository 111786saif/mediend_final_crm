'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { apiGet } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Database,
  Clock,
  Users,
  TrendingUp,
  CalendarDays,
  Minimize2,
  X,
  Sparkles,
} from 'lucide-react'

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

function getEmployeeProgress(emp: SyncJobEmployee): { done: number; total: number } {
  let total = 0; let done = 0
  if (emp.leads.enabled) { total++; if (emp.leads.status === 'done' || emp.leads.status === 'error') done++ }
  if (emp.attendance.enabled) { total++; if (emp.attendance.status === 'done' || emp.attendance.status === 'error') done++ }
  return { done, total }
}

function StatusPill({ status }: { status: 'pending' | 'syncing' | 'done' | 'error' }) {
  const map = {
    pending: { label: 'Queued', cls: 'bg-muted text-muted-foreground', icon: <Clock className="h-3 w-3" /> },
    syncing: { label: 'Syncing', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    done:    { label: 'Done',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
    error:   { label: 'Error',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: <XCircle className="h-3 w-3" /> },
  }
  const { label, cls, icon } = map[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {icon}{label}
    </span>
  )
}

function SyncRow({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode
  label: string
  status: 'pending' | 'syncing' | 'done' | 'error'
  detail: string
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
      status === 'syncing' && 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20',
      status === 'done'    && 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20',
      status === 'error'   && 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20',
      status === 'pending' && 'border-border bg-muted/30',
    )}>
      <span className={cn(
        'shrink-0',
        status === 'syncing' && 'text-blue-500',
        status === 'done'    && 'text-emerald-500',
        status === 'error'   && 'text-red-500',
        status === 'pending' && 'text-muted-foreground',
      )}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none mb-0.5">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
      <StatusPill status={status} />
    </div>
  )
}

function EmployeeCard({ emp }: { emp: SyncJobEmployee }) {
  const { done, total } = getEmployeeProgress(emp)
  const allDone = done === total && total > 0
  const hasError = (emp.leads.enabled && emp.leads.status === 'error') || (emp.attendance.enabled && emp.attendance.status === 'error')
  const initials = emp.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-all',
      allDone && !hasError && 'border-emerald-200 dark:border-emerald-800',
      hasError && 'border-red-200 dark:border-red-800',
    )}>
      {/* Employee header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <div className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
          allDone && !hasError ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
            : hasError ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
            : 'bg-primary/10 text-primary',
        )}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-none">{emp.employeeName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Code: <span className="font-mono">{emp.employeeCode}</span>
            {emp.bdNumber !== null && <> · CRM <span className="font-mono">#{emp.bdNumber}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">{done}/{total}</span>
          <span>tasks</span>
          {allDone && !hasError && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-1" />}
          {hasError && <XCircle className="h-4 w-4 text-red-500 ml-1" />}
        </div>
      </div>

      {/* Sync rows */}
      <div className="p-3 space-y-2">
        {emp.leads.enabled && (
          <SyncRow
            icon={<TrendingUp className="h-4 w-4" />}
            label="Leads"
            status={emp.leads.status}
            detail={
              emp.leads.status === 'pending' ? 'Waiting to start...' :
              emp.leads.status === 'syncing' ? `${emp.leads.created} created · ${emp.leads.updated} updated` :
              emp.leads.status === 'done'    ? `${emp.leads.created} created · ${emp.leads.updated} updated` :
              emp.leads.message || 'Sync failed'
            }
          />
        )}
        {emp.attendance.enabled && (
          <SyncRow
            icon={<CalendarDays className="h-4 w-4" />}
            label="Attendance"
            status={emp.attendance.status}
            detail={
              emp.attendance.status === 'pending' ? 'Waiting to start...' :
              emp.attendance.status === 'syncing' ? `${emp.attendance.processed} / ${emp.attendance.total || '?'} records` :
              emp.attendance.status === 'done'    ? `${emp.attendance.processed} processed · ${emp.attendance.skipped} skipped` :
              emp.attendance.message || 'Sync failed'
            }
          />
        )}
      </div>
    </div>
  )
}

interface SyncProgressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string | null
}

export function SyncProgressModal({ open, onOpenChange, jobId }: SyncProgressModalProps) {
  const skipBackOnCloseRef = useRef(false)
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
          if (closedWhileRunning.current) toast.success('Background sync completed successfully.')
        }
      } catch {
        // Keep polling on transient errors
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [open, jobId])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      skipBackOnCloseRef.current = true
      if (job?.status === 'running') {
        closedWhileRunning.current = true
        toast.info("Sync is running in the background. You'll be notified when it completes.")
      }
    }
    onOpenChange(next)
  }

  const handleClose = () => handleOpenChange(false)

  const isRunning = job?.status === 'running'
  const isComplete = job?.status === 'completed'
  const progress = job ? getOverallProgress(job) : 0

  const totalLeads = job?.employees.reduce((s, e) => s + (e.leads.enabled ? e.leads.created + e.leads.updated : 0), 0) ?? 0
  const totalAttendance = job?.employees.reduce((s, e) => s + (e.attendance.enabled ? e.attendance.processed : 0), 0) ?? 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <DialogContent
        className="max-w-3xl w-full p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]"
        onInteractOutside={(e) => { if (isRunning) e.preventDefault() }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              isRunning  && 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
              isComplete && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
              !isRunning && !isComplete && 'bg-muted text-muted-foreground',
            )}>
              {isRunning  ? <Loader2 className="h-5 w-5 animate-spin" /> : isComplete ? <Sparkles className="h-5 w-5" /> : <Database className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold leading-none">
                {isRunning ? 'Syncing Historical Data' : isComplete ? 'Sync Complete' : 'Sync Status'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {isRunning
                  ? `Processing ${job?.employees.length ?? '…'} employee${(job?.employees.length ?? 0) !== 1 ? 's' : ''} — leads & attendance data`
                  : isComplete
                    ? `Synced ${totalLeads.toLocaleString()} leads and ${totalAttendance.toLocaleString()} attendance records`
                    : 'Viewing sync job status'}
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {isRunning ? <Minimize2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning banner */}
          {isRunning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                <span className="font-semibold">Do not close or refresh</span> while syncing is ongoing. You can minimize this dialog and the sync will continue in the background.
              </p>
            </div>
          )}

          {/* Overall progress */}
          <div className="rounded-xl border bg-card px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Overall Progress
              </div>
              <span className={cn(
                'text-sm font-bold tabular-nums',
                progress === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
              )}>
                {progress}%
              </span>
            </div>
            <Progress
              value={progress}
              className={cn('h-2.5 rounded-full', isRunning && '[&>div]:transition-all [&>div]:duration-500')}
            />
            {isComplete && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> All sync operations finished successfully
              </p>
            )}
          </div>

          {/* Employee cards */}
          {job?.employees && job.employees.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                Employees ({job.employees.length})
              </p>
              {job.employees.map((emp) => (
                <EmployeeCard key={emp.employeeId} emp={emp} />
              ))}
            </div>
          )}

          {/* Loading skeleton while job hasn't loaded yet */}
          {!job && (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border bg-muted/40 h-28" />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground">
            {isRunning ? 'Sync in progress…' : isComplete ? `Completed · ${totalLeads} leads · ${totalAttendance} attendance records` : ''}
          </p>
          {isRunning ? (
            <Button variant="outline" size="sm" onClick={handleClose} className="gap-1.5">
              <Minimize2 className="h-3.5 w-3.5" />
              Minimize
            </Button>
          ) : (
            <Button size="sm" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
