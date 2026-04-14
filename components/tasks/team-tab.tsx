"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  UserPlus,
  Star,
  ArrowUpRight,
  Clock,
  ChevronRight,
  Trophy,
  Medal,
  SlidersHorizontal,
  AlertTriangle,
  ListTodo,
  Check,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useMDTeamOverview, type MDTeamOverviewMember } from "@/hooks/use-md-team"
import { useWarnings } from "@/hooks/use-tasks"
import { getAvatarColor } from "@/lib/avatar-colors"
import { AddPersonDialog } from "./add-person-dialog"
import { cn } from "@/lib/utils"
import { formatRating } from "@/lib/format-rating"

type SortKey = "rating" | "pending" | "warnings" | "approvals"

const SORT_OPTIONS: {
  key: SortKey
  label: string
  subtitle: string
  icon: React.ElementType
  accent: string
}[] = [
  {
    key: "rating",
    label: "Rating",
    subtitle: "Highest rating first",
    icon: Star,
    accent: "text-amber-500",
  },
  {
    key: "pending",
    label: "Pending tasks",
    subtitle: "Most pending first",
    icon: ListTodo,
    accent: "text-indigo-600",
  },
  {
    key: "warnings",
    label: "Warnings",
    subtitle: "Most warnings first",
    icon: AlertTriangle,
    accent: "text-rose-600",
  },
  {
    key: "approvals",
    label: "Approvals pending",
    subtitle: "Most extension requests first",
    icon: ArrowUpRight,
    accent: "text-violet-600",
  },
]

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
  const [sortKey, setSortKey] = useState<SortKey>("rating")
  const [sortOpen, setSortOpen] = useState(false)

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
    const arr = [...members]
    switch (sortKey) {
      case "pending":
        arr.sort(
          (a, b) =>
            (b.taskCount - b.completedCount) - (a.taskCount - a.completedCount)
        )
        break
      case "warnings":
        arr.sort(
          (a, b) =>
            (warningsByUserId[b.id] ?? 0) - (warningsByUserId[a.id] ?? 0)
        )
        break
      case "approvals":
        arr.sort(
          (a, b) => (b.extensionRequests ?? 0) - (a.extensionRequests ?? 0)
        )
        break
      case "rating":
      default:
        arr.sort((a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1))
    }
    return arr
  }, [members, sortKey, warningsByUserId])

  const activeSort = SORT_OPTIONS.find((o) => o.key === sortKey) ?? SORT_OPTIONS[0]

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
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0 relative",
              sortKey !== "rating" && "border-indigo-400 text-indigo-600"
            )}
            aria-label={`Sort: ${activeSort.label}`}
            onClick={() => setSortOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {sortKey !== "rating" && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-indigo-500" />
            )}
          </Button>
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

      <Drawer open={sortOpen} onOpenChange={setSortOpen} direction="bottom">
        <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
              Sort team
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-2">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = sortKey === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setSortKey(opt.key)
                    setSortOpen(false)
                  }}
                  className={cn(
                    "flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left touch-manipulation active:bg-muted/50 transition-colors",
                    active && "bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-300 dark:ring-indigo-700"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      active ? "bg-indigo-100 dark:bg-indigo-900/60" : "bg-muted"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", opt.accent)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold", active && "text-indigo-700 dark:text-indigo-300")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{opt.subtitle}</p>
                  </div>
                  {active && <Check className="h-5 w-5 shrink-0 text-indigo-600" />}
                </button>
              )
            })}
          </div>
        </DrawerContent>
      </Drawer>
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
            {formatRating(member.averageRating)}
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
