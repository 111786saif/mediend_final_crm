'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useState } from 'react'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, UserCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface Appointment {
  id: string
  preferredDate: string | null
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  remarks: string | null
  createdAt: string
  meet?: {
    id: string
    title: string
    scheduledAt: string
    type: 'VIRTUAL' | 'OFFLINE'
    meetLink: string | null
    location: string | null
    module: string
  } | null
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
  COMPLETED: { label: 'Completed', variant: 'default' as const, icon: CheckCircle },
}

export default function MDAppointmentPage() {
  const [preferredDate, setPreferredDate] = useState('')
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['my-md-appointments'],
    queryFn: () => apiGet<Appointment[]>('/api/employee/md-appointment'),
  })

  const submitMutation = useMutation({
    mutationFn: (data: { preferredDate?: string; reason: string }) =>
      apiPost<Appointment>('/api/employee/md-appointment', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-md-appointments'] })
      setPreferredDate('')
      setReason('')
      toast.success('Appointment request submitted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit request')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters')
      return
    }
    submitMutation.mutate({
      preferredDate: preferredDate.trim() || undefined,
      reason,
    })
  }

  const hasPendingAppointment = appointments?.some((a) => a.status === 'PENDING')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Request Appointment with MD</h1>
        <p className="text-muted-foreground mt-1">Schedule a meeting with the Managing Director</p>
      </div>

      {/* Request Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Request Appointment
          </CardTitle>
          <CardDescription>
            Submit a request for a meeting with the MD
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPendingAppointment ? (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-amber-700">
                You have a pending appointment request. Please wait for a response before submitting a new one.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="preferredDate">Scheduled day (optional)</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="mt-2 rounded-xl"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Suggest a day; MD will confirm the exact time. Leave empty if flexible.
                </p>
              </div>

              <div>
                <Label htmlFor="reason">Reason for Appointment *</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the purpose of the meeting..."
                  rows={4}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 10 characters required
                </p>
              </div>

              <Button type="submit" disabled={submitMutation.isPending || reason.length < 10}>
                <Calendar className="h-4 w-4 mr-2" />
                {submitMutation.isPending ? 'Submitting...' : 'Request Appointment'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Appointment History */}
      <Card>
        <CardHeader>
          <CardTitle>My Appointment Requests</CardTitle>
          <CardDescription>Track the status of your appointment requests</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : appointments && appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((appointment) => {
                const statusConfig = STATUS_CONFIG[appointment.status]
                const StatusIcon = statusConfig.icon
                return (
                  <div key={appointment.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Requested on {format(new Date(appointment.createdAt), 'PPP')}
                        </p>
                        {appointment.preferredDate && (
                          <p className="text-sm flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            Scheduled: {format(new Date(appointment.preferredDate), 'PPP')}
                          </p>
                        )}
                      </div>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    
                    <p className="font-medium mb-2">Reason:</p>
                    <p className="text-sm bg-muted/50 p-3 rounded">{appointment.reason}</p>
                    
                    {appointment.remarks && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm font-medium text-blue-700">MD Remarks:</p>
                        <p className="text-sm text-blue-600">{appointment.remarks}</p>
                      </div>
                    )}
                    {appointment.status === 'APPROVED' && appointment.meet && (
                      <div className="mt-3 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/80">
                        <p className="text-sm font-semibold text-emerald-800">Scheduled meet</p>
                        <p className="text-sm mt-1">
                          {format(new Date(appointment.meet.scheduledAt), 'PPP p')}
                        </p>
                        {appointment.meet.location && (
                          <p className="text-xs text-muted-foreground mt-1">{appointment.meet.location}</p>
                        )}
                        {appointment.meet.meetLink && (
                          <Button size="sm" className="mt-2 rounded-lg" asChild>
                            <a href={appointment.meet.meetLink} target="_blank" rel="noreferrer">
                              Join link
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No appointment requests yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

