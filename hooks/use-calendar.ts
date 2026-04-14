import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'
import type { DirectoryUser } from '@/app/api/users/directory/route'

export type CalendarAttendanceDay = {
  date: string
  status: 'in' | 'out' | 'leave'
  inTime: string | null
  outTime: string | null
}

export type CalendarStatusKind = 'AVAILABLE' | 'ONLINE_ONLY' | 'UNAVAILABLE' | 'CUSTOM'

export type CalendarStatus = {
  id: string
  userId: string
  kind: CalendarStatusKind
  label: string | null
  startsAt: string
  endsAt: string
  createdAt: string
}

export type CalendarMeet = {
  id: string
  title: string
  description: string | null
  type: 'VIRTUAL' | 'OFFLINE'
  meetLink: string | null
  location: string | null
  scheduledAt: string
  endTime: string | null
  module: 'INTERVIEW' | 'MD_APPOINTMENT' | 'GENERAL'
  candidateName: string | null
  candidatePhone: string | null
  candidateRole: string | null
  resumeUrl: string | null
  notes: string | null
  createdById: string
  createdBy: { id: string; name: string; email: string }
  participants: Array<{
    userId: string
    attended: boolean | null
    remarks: string | null
    user: { id: string; name: string; email: string } | null
  }>
  mdAppointment?: {
    id: string
    status: string
    employeeId: string
    employee?: { user?: { name: string } | null } | null
  } | null
}

export type CalendarEventsResponse = {
  meets: CalendarMeet[]
  attendance: CalendarAttendanceDay[]
  statuses: CalendarStatus[]
  counts: { upcomingMeets: number; upcomingInterviews: number }
}

export function useCalendarEvents(params: {
  targetUserId: string | undefined
  from: string
  to: string
  enabled?: boolean
}) {
  const { targetUserId, from, to, enabled = true } = params
  return useQuery<CalendarEventsResponse>({
    queryKey: ['calendar-events', targetUserId, from, to],
    queryFn: () => {
      const sp = new URLSearchParams({ from, to })
      if (targetUserId) sp.set('targetUserId', targetUserId)
      return apiGet<CalendarEventsResponse>(`/api/calendar/events?${sp.toString()}`)
    },
    enabled: enabled && !!from && !!to,
    staleTime: 30_000,
  })
}

export function useUserDirectory() {
  return useQuery<DirectoryUser[]>({
    queryKey: ['user-directory'],
    queryFn: () => apiGet<DirectoryUser[]>('/api/users/directory'),
    staleTime: 5 * 60_000,
  })
}

export function useMyStatuses() {
  return useQuery<CalendarStatus[]>({
    queryKey: ['my-statuses'],
    queryFn: () => apiGet<CalendarStatus[]>('/api/calendar/statuses'),
    staleTime: 30_000,
  })
}

export function useCreateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      kind: CalendarStatusKind
      label?: string | null
      startsAt: string
      endsAt: string
    }) => apiPost<CalendarStatus>('/api/calendar/statuses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-statuses'] })
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useDeleteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ id: string }>(`/api/calendar/statuses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-statuses'] })
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}
