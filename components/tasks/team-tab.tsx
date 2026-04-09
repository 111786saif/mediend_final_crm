"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, UserPlus, Star, ArrowUpRight, Clock, ChevronRight, Trophy, Medal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useMDTeamOverview, type MDTeamOverviewMember } from "@/hooks/use-md-team"
import { useWarnings } from "@/hooks/use-tasks"
import { getAvatarColor } from "@/lib/avatar-colors"
import { AddPersonDialog } from "./add-person-dialog"
import { cn } from "@/lib/utils"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || "?"
}

const STAR_COLOR: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-emerald-500",
  5: "text-emerald-600",
}

function getStarColor(rating: number): string {
  const rounded = Math.round(rating)
  return STAR_COLOR[Math.min(5, Math.max(1, rounded))] ?? "text-amber-500"
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

function hasStaleWorkLog(lastWorkLogAt: string | null): boolean {
  if (!lastWorkLogAt) return true
  const last = new Date(lastWorkLogAt).getTime()
  return Date.now() - last > TWENTY_FOUR_HOURS_MS
}

export function TeamTab() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [addPersonOpen, setAddPersonOpen] = useState(false)

  const { data, isLoading, isError, error } = useMDTeamOverview(search || undefined)
  const { data: warnings = [] } = useWarnings()
  const members = data?.members ?? []

  const warningsByUserId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const w of warnings) {
      map[w.employeeId] = (map[w.employeeId] ?? 0) + 1
    }
    return map
  }, [warnings])

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const ra = a.averageRating ?? -1
      const rb = b.averageRating ?? -1
      return rb - ra
    })
  }, [members])

  if (isError) {
    return (
      <div className="py-6 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load team."}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search team members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search team members"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setAddPersonOpen(true)}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add person
        </Button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Loading team…
        </div>
      ) : members.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {search ? "No team members match your search." : "No team members yet. Add people to get started."}
        </div>
      ) : (
        <div className="bg-white dark:bg-card rounded-lg border border-border divide-y divide-border mt-4">
          {sortedMembers.map((member, index) => (
            <TeamMemberRow
              key={member.id}
              member={member}
              rank={index + 1}
              warningCount={warningsByUserId[member.id] ?? 0}
              onClick={() => router.push(`/md/tasks/team/${member.id}`)}
            />
          ))}
        </div>
      )}

      <AddPersonDialog open={addPersonOpen} onOpenChange={setAddPersonOpen} />
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />
  return <span className="text-xs font-semibold text-muted-foreground w-5 text-center">{rank}</span>
}

function TeamMemberRow({
  member,
  rank,
  warningCount,
  onClick,
}: {
  member: MDTeamOverviewMember
  rank: number
  warningCount: number
  onClick: () => void
}) {
  const isIn = member.attendanceStatus === "in"
  const isLeave = member.attendanceStatus === "leave"

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Rank */}
      <div className="shrink-0 flex items-center justify-center w-6">
        <RankBadge rank={rank} />
      </div>

      {/* Avatar */}
      <Avatar className="size-10 shrink-0">
        <AvatarFallback
          className={cn(
            "font-semibold text-sm",
            getAvatarColor(member.name).bg,
            getAvatarColor(member.name).text
          )}
        >
          {getInitials(member.name)}
        </AvatarFallback>
      </Avatar>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium truncate">{member.name}</span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              isLeave && "bg-amber-100 text-amber-800",
              isIn && "bg-green-100 text-green-800",
              !isIn && !isLeave && "bg-muted text-muted-foreground"
            )}
          >
            {isLeave ? "Leave" : isIn ? "IN" : "OUT"}
          </span>
          {(member.unseenActivityCount ?? 0) > 0 && (
            <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {member.unseenActivityCount! > 99 ? "99+" : member.unseenActivityCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="truncate">{member.designation || member.role || member.department?.name || "—"}</span>
          {member.worklogEnforced && hasStaleWorkLog(member.lastWorkLogAt) && (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-amber-600">
              <Clock className="h-3 w-3" />
              No log 24h+
            </span>
          )}
        </div>
      </div>

      {/* Rating + indicators */}
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {member.averageRating != null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold text-sm", getStarColor(member.averageRating))}>
            <Star className="h-4 w-4 fill-current" />
            {member.averageRating.toFixed(1)}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
        {warningCount > 0 && (
          <span className="font-semibold text-red-600">{warningCount}w</span>
        )}
        {(member.extensionRequests ?? 0) > 0 && (
          <span className="inline-flex items-center gap-0.5 text-violet-600">
            <ArrowUpRight className="h-3 w-3" />
            {member.extensionRequests}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
