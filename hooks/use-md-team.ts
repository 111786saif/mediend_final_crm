import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"

export type TeamMemberSource = "team" | "watchlist" | "subordinate"
export type AttendanceStatus = "in" | "out" | "leave"

export interface MDTeamOverviewMember {
  id: string
  employeeId: string
  name: string
  email: string
  role: string
  designation: string | null
  department: { id: string; name: string } | null
  taskCount: number
  overdueCount: number
  completedCount: number
  averageRating: number | null
  extensionRequests: number
  unseenActivityCount: number
  attendanceStatus: AttendanceStatus
  inTime: string | null
  lastWorkLogAt: string | null
  worklogEnforced: boolean
  source: TeamMemberSource
}

interface MDTeamOverviewResponse {
  members: MDTeamOverviewMember[]
}


export function useMDTeamOverview(search?: string) {
  const queryString = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""
  return useQuery<MDTeamOverviewResponse>({
    queryKey: ["md-team-overview", search ?? ""],
    queryFn: () => apiGet<MDTeamOverviewResponse>(`/api/md/team-overview${queryString}`),
  })
}

