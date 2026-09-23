import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '@/lib/api-client'
import type { DirectoryUser } from '@/app/api/users/directory/route'
import type { TeamBdOption } from '@/app/api/calendar/team-bds/route'

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

/**
 * BDs under the current user (TL / ACM / CM / Sales Head) — for the IPD
 * calendar team filter.
 *
 * Mirrors the role-simulation pattern from `usePermissions()`: TESTER/ADMIN/MD
 * accounts can "view as" another role client-side (see `useAuth()`), but the
 * backend only knows their real DB role. Without forwarding the simulated
 * role as `?role=`, this always resolved against the real role and returned
 * an empty team for any simulated account — which is why the filter would
 * flash in (frontend gate passes) then disappear (backend returns []).
 */
export function useTeamBds() {
  const activeRole =
    typeof window !== 'undefined' ? localStorage.getItem('mediend_tester_active_role') : null

  return useQuery<TeamBdOption[]>({
    queryKey: ['team-bds', activeRole],
    queryFn: () => {
      const url = activeRole ? `/api/calendar/team-bds?role=${activeRole}` : '/api/calendar/team-bds'
      return apiGet<TeamBdOption[]>(url)
    },
    staleTime: 5 * 60_000,
  })
}

/** IPD/OPD combined calendar feed — type/status/bdId filterable */
export type CaseEventType = 'IPD' | 'OPD'
export type CaseEventStatus = 'DONE' | 'SCHEDULED' | 'POSTPONED' | 'CANCELLED' | 'POSSIBLE'
export type CaseEvent = {
  id: string
  leadId: number
  patientName: string
  bdId: string
  bdName: string
  type: CaseEventType
  status: CaseEventStatus
  date: string
  hospital: string | null
  doctor: string | null
  treatment: string | null
  circle: string | null
}

export function useCaseEvents(params: {
  startDate: string
  endDate: string
  types?: CaseEventType[]
  statuses?: CaseEventStatus[]
  bdIds?: string[]
  enabled?: boolean
}) {
  const { startDate, endDate, types = [], statuses = [], bdIds, enabled = true } = params
  return useQuery<CaseEvent[]>({
    queryKey: ['case-events', startDate, endDate, types.join(','), statuses.join(','), bdIds?.join(',') ?? ''],
    queryFn: () => {
      const sp = new URLSearchParams({
        startDate,
        endDate,
        type: types.join(','),
        status: statuses.join(','),
      })
      if (bdIds && bdIds.length > 0) sp.set('bdId', bdIds.join(','))
      return apiGet<CaseEvent[]>(`/api/calendar/case-events?${sp.toString()}`)
    },
    enabled: enabled && !!startDate && !!endDate,
    staleTime: 30_000,
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