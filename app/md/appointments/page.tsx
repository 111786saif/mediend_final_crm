'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useMemo, useState } from 'react'
import { Calendar, Clock, CheckCircle, XCircle, Building } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  preferredDate: string | null
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  remarks: string | null
  createdAt: string
  employee: {
    employeeCode: string
    user: {
      name: string
      email: string
    }
    department: {
      name: string
    } | null
  }
  meet?: {
    id: string
    scheduledAt: string
    location: string | null
    meetLink: string | null
    type: string
  } | null
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    variant: 'secondary' as const,
    icon: Clock,
    chipActive: 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-300/50',
    chipIdle: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/40',
    cardBorder: 'border-l-amber-500',
    avatarBg: 'bg-gradient-to-br from-amber-500 to-amber-700 text-white',
  },
  APPROVED: {
    label: 'Approved',
    variant: 'default' as const,
    icon: CheckCircle,
    chipActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-300/50',
    chipIdle: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
    cardBorder: 'border-l-emerald-500',
    avatarBg: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white',
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'destructive' as const,
    icon: XCircle,
    chipActive: 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-300/50',
    chipIdle: 'bg-rose-100 text-rose-900 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-900/30',
    cardBorder: 'border-l-rose-500',
    avatarBg: 'bg-gradient-to-br from-rose-400 to-red-600 text-white',
  },
  COMPLETED: {
    label: 'Completed',
    variant: 'default' as const,
    icon: CheckCircle,
    chipActive: 'bg-violet-600 text-white shadow-md shadow-violet-600/25 ring-2 ring-violet-300/50',
    chipIdle: 'bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/30',
    cardBorder: 'border-l-violet-500',
    avatarBg: 'bg-gradient-to-br from-violet-400 to-indigo-600 text-white',
  },
}

const STATUS_ORDER: Record<Appointment['status'], number> = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  COMPLETED: 3,
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function MDAppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['md-appointments'],
    queryFn: () => apiGet<Appointment[]>('/api/md/appointments'),
  })

  const displayAppointments = useMemo(() => {
    let list =
      statusFilter === 'all'
        ? [...appointments]
        : appointments.filter((a) => a.status === statusFilter)
    return list.sort((a, b) => {
      if (statusFilter === 'all') {
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (byStatus !== 0) return byStatus
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [appointments, statusFilter])

  const updateMutation = useMutation({
    mutationFn: (body: {
      id: string
      status: string
      remarks?: string
      scheduledAt?: string
      type?: 'VIRTUAL' | 'OFFLINE'
      meetLink?: string | null
      location?: string | null
    }) => {
      const { id, ...rest } = body
      return apiPatch<Appointment>(`/api/md/appointments?id=${id}`, rest)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['md-appointments'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      if (variables.status === 'APPROVED') {
        toast.success('Meet scheduled')
      } else {
        toast.success('Appointment updated')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update')
    },
  })

  const pendingCount = appointments.filter((a) => a.status === 'PENDING').length

  const filterOptions: { value: string; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: appointments.length },
    { value: 'PENDING', label: 'Pending', count: appointments.filter((a) => a.status === 'PENDING').length },
    { value: 'APPROVED', label: 'Approved', count: appointments.filter((a) => a.status === 'APPROVED').length },
    { value: 'REJECTED', label: 'Rejected', count: appointments.filter((a) => a.status === 'REJECTED').length },
    { value: 'COMPLETED', label: 'Done', count: appointments.filter((a) => a.status === 'COMPLETED').length },
  ]

  return (
    <AuthenticatedLayout>
      <div className="min-w-0 space-y-5 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">MD appointment</h1>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="shrink-0 text-xs font-medium">
              {pendingCount} pending
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">Status</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
            {filterOptions.map((opt) => {
              const isAll = opt.value === 'all'
              const cfg = !isAll ? STATUS_CONFIG[opt.value as keyof typeof STATUS_CONFIG] : null
              const active = statusFilter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-all',
                    'border border-transparent min-h-[44px] sm:min-h-0',
                    isAll &&
                      (active
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                        : 'bg-card text-foreground border-border shadow-sm hover:bg-muted/80'),
                    !isAll &&
                      cfg &&
                      (active ? cfg.chipActive : cn(cfg.chipIdle, 'border border-black/5 dark:border-white/10'))
                  )}
                >
                  {opt.label}
                  {opt.count != null && (
                    <span
                      className={cn(
                        'ml-1.5 tabular-nums opacity-90',
                        active && 'font-bold'
                      )}
                    >
                      ({opt.count})
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading appointments…</div>
        ) : displayAppointments.length > 0 ? (
          <ul className="space-y-3 sm:space-y-4">
            {displayAppointments.map((appointment) => {
              const statusConfig = STATUS_CONFIG[appointment.status]
              const StatusIcon = statusConfig.icon
              const name = appointment.employee.user.name
              return (
                <li
                  key={appointment.id}
                  className={cn(
                    'rounded-2xl border border-border/80 bg-card/95 shadow-sm backdrop-blur-sm',
                    'border-l-4',
                    statusConfig.cardBorder
                  )}
                >
                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex gap-3 min-w-0">
                      <Avatar size="lg" className="ring-2 ring-background shadow-md">
                        <AvatarFallback
                          className={cn('text-base font-bold', statusConfig.avatarBg)}
                        >
                          {initialsFromName(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-base leading-tight">{name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {appointment.employee.employeeCode}
                            </p>
                          </div>
                          <Badge variant={statusConfig.variant} className="flex items-center gap-1 shrink-0">
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        {appointment.employee.department && (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building className="h-3.5 w-3.5 shrink-0 text-amber-600/80 dark:text-amber-400/80" />
                            {appointment.employee.department.name}
                          </p>
                        )}
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
                          <span>
                            <span className="font-medium text-foreground/80">Requested:</span>{' '}
                            {format(new Date(appointment.createdAt), 'PP')}
                          </span>
                          {appointment.preferredDate && (
                            <span>
                              <span className="font-medium text-foreground/80">Scheduled:</span>{' '}
                              {format(new Date(appointment.preferredDate), 'PP')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Reason</p>
                      <p className="text-sm leading-relaxed rounded-xl bg-muted/60 dark:bg-muted/30 px-3 py-2.5 border border-border/50">
                        {appointment.reason}
                      </p>
                    </div>

                    {appointment.remarks && (
                      <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 dark:border-sky-800 dark:bg-sky-950/30">
                        <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">Your remarks</p>
                        <p className="text-sm text-sky-900 dark:text-sky-100 mt-0.5">{appointment.remarks}</p>
                      </div>
                    )}

                    {appointment.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <ApproveMeetSheet
                          appointment={appointment}
                          onSubmit={async (payload) => {
                            await updateMutation.mutateAsync({
                              id: appointment.id,
                              status: 'APPROVED',
                              ...payload,
                            })
                          }}
                          isLoading={updateMutation.isPending}
                        />
                        <AppointmentRejectDialog
                          appointment={appointment}
                          onSubmit={(remarks) =>
                            updateMutation.mutate({
                              id: appointment.id,
                              status: 'REJECTED',
                              remarks,
                            })
                          }
                          isLoading={updateMutation.isPending}
                        />
                      </div>
                    )}

                    {appointment.status === 'APPROVED' && appointment.meet && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/25">
                        <p className="font-medium text-emerald-900 dark:text-emerald-100">
                          Scheduled: {format(new Date(appointment.meet.scheduledAt), 'PPp')}
                        </p>
                        {appointment.meet.location && (
                          <p className="text-muted-foreground mt-1 text-xs">{appointment.meet.location}</p>
                        )}
                        {appointment.meet.meetLink && (
                          <Button size="sm" className="mt-2 w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700" asChild>
                            <a href={appointment.meet.meetLink} target="_blank" rel="noreferrer">
                              Open meet link
                            </a>
                          </Button>
                        )}
                      </div>
                    )}

                    {appointment.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto rounded-xl border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
                        onClick={() =>
                          updateMutation.mutate({
                            id: appointment.id,
                            status: 'COMPLETED',
                          })
                        }
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Mark completed
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-muted-foreground/25 bg-card/50">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-amber-500/70" />
            <p className="text-muted-foreground text-sm font-medium">No appointments match this filter</p>
            {statusFilter !== 'all' && (
              <Button variant="link" className="mt-2 text-amber-700 dark:text-amber-400" onClick={() => setStatusFilter('all')}>
                Show all
              </Button>
            )}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  )
}

function ApproveMeetSheet({
  appointment,
  onSubmit,
  isLoading,
}: {
  appointment: Appointment
  onSubmit: (payload: {
    remarks?: string
    scheduledAt: string
    type: 'VIRTUAL' | 'OFFLINE'
    meetLink?: string | null
    location?: string | null
  }) => Promise<void>
  isLoading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [meetType, setMeetType] = useState<'VIRTUAL' | 'OFFLINE'>('OFFLINE')
  const [location, setLocation] = useState("MD's Office")
  const [meetLink, setMeetLink] = useState('')
  const [remarks, setRemarks] = useState('')

  const handleSubmit = async () => {
    if (!scheduledAt.trim()) {
      toast.error('Pick date and time for the meeting')
      return
    }
    const iso = new Date(scheduledAt).toISOString()
    try {
      await onSubmit({
        remarks: remarks.trim() || undefined,
        scheduledAt: iso,
        type: meetType,
        meetLink: meetType === 'VIRTUAL' ? meetLink.trim() || null : null,
        location: meetType === 'OFFLINE' ? location.trim() || "MD's Office" : null,
      })
      setOpen(false)
      setScheduledAt('')
      setMeetType('OFFLINE')
      setLocation("MD's Office")
      setMeetLink('')
      setRemarks('')
    } catch {
      /* toast from mutation */
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
        onClick={() => setOpen(true)}
      >
        <CheckCircle className="h-4 w-4 mr-1.5" />
        Approve &amp; schedule
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Schedule MD meet</SheetTitle>
            <SheetDescription>
              {appointment.employee.user.name} — title uses their request reason. Default: offline at MD&apos;s office.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4 px-1">
            <div>
              <Label>Date &amp; time *</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={meetType === 'OFFLINE' ? 'default' : 'outline'}
                className="flex-1 rounded-xl"
                onClick={() => setMeetType('OFFLINE')}
              >
                Offline
              </Button>
              <Button
                type="button"
                variant={meetType === 'VIRTUAL' ? 'default' : 'outline'}
                className="flex-1 rounded-xl"
                onClick={() => setMeetType('VIRTUAL')}
              >
                Virtual
              </Button>
            </div>
            {meetType === 'OFFLINE' && (
              <div>
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
            )}
            {meetType === 'VIRTUAL' && (
              <div>
                <Label>Meet link</Label>
                <Input
                  value={meetLink}
                  onChange={(e) => setMeetLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="mt-1 rounded-xl"
                />
              </div>
            )}
            <div>
              <Label>Remarks for employee (optional)</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl bg-emerald-600" onClick={handleSubmit} disabled={isLoading}>
              Confirm schedule
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function AppointmentRejectDialog({
  appointment,
  onSubmit,
  isLoading,
}: {
  appointment: Appointment
  onSubmit: (remarks?: string) => void
  isLoading: boolean
}) {
  const [remarks, setRemarks] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = () => {
    onSubmit(remarks || undefined)
    setOpen(false)
    setRemarks('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive" className="w-full sm:w-auto rounded-xl">
          <XCircle className="h-4 w-4 mr-1.5" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Reject appointment</DialogTitle>
          <DialogDescription>
            Reject request from {appointment.employee.user.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Reason (optional)</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional message for the employee"
              className="rounded-xl mt-1"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleSubmit} disabled={isLoading}>
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
