'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { format, isThisWeek, isToday, isTomorrow, differenceInMinutes } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CreateMeetDrawer } from '@/components/meets/create-meet-drawer'
import {
  MeetDetailsDrawer,
  type MeetDetailsMeet,
} from '@/components/meets/meet-details-drawer'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  MapPin,
  Video,
  CalendarDays,
  Plus,
  ChevronRight,
  Clock,
} from 'lucide-react'

type MeetParticipantRow = {
  userId: string
  user?: { id: string; name: string; email: string } | null
  attended: boolean | null
  remarks: string | null
}

type MeetRow = {
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
  createdBy: { id: string; name: string; email: string }
  participants?: MeetParticipantRow[]
  mdAppointment?: {
    employee?: { user?: { name: string } | null } | null
  } | null
}

function meetRequesterLabel(m: MeetRow): string {
  if (m.module === 'MD_APPOINTMENT') {
    const requester = m.mdAppointment?.employee?.user?.name
    if (requester) return requester
  }
  return m.createdBy.name
}

function moduleLabel(m: MeetRow['module']) {
  switch (m) {
    case 'INTERVIEW':
      return 'Interview'
    case 'MD_APPOINTMENT':
      return 'MD'
    default:
      return 'Meet'
  }
}

function moduleBadgeClass(m: MeetRow['module']) {
  switch (m) {
    case 'INTERVIEW':
      return 'bg-violet-600 text-white border-0'
    case 'MD_APPOINTMENT':
      return 'bg-amber-600 text-white border-0'
    default:
      return 'bg-indigo-600 text-white border-0'
  }
}

function formatDurationShort(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

type CanCreateResponse = { canCreate: boolean }

function myParticipationRow(meet: MeetRow, userId: string | undefined) {
  if (!userId) return null
  return meet.participants?.find((p) => p.userId === userId) ?? null
}

export default function MeetsPage() {
  const { user } = useAuth()
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedMeet, setSelectedMeet] = useState<MeetRow | null>(null)

  const { data: createEligibility } = useQuery<CanCreateResponse>({
    queryKey: ['meets', 'can-create'],
    queryFn: () => apiGet<CanCreateResponse>('/api/meets/can-create'),
  })

  const { data: meets = [], isLoading } = useQuery<MeetRow[]>({
    queryKey: ['meets', 'all', moduleFilter],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (moduleFilter !== 'all') p.set('module', moduleFilter)
      const q = p.toString()
      return apiGet<MeetRow[]>(`/api/meets${q ? `?${q}` : ''}`)
    },
  })

  const grouped = useMemo(() => {
    const now = new Date()
    const today: MeetRow[] = []
    const tomorrow: MeetRow[] = []
    const thisWeek: MeetRow[] = []
    const later: MeetRow[] = []

    const sorted = [...meets].sort(
      (a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
    )

    for (const m of sorted) {
      const d = new Date(m.scheduledAt)
      if (isToday(d)) {
        today.push(m)
        continue
      }
      if (d < now) continue
      if (isTomorrow(d)) tomorrow.push(m)
      else if (isThisWeek(d, { weekStartsOn: 1 })) thisWeek.push(m)
      else later.push(m)
    }

    return { today, tomorrow, thisWeek, later }
  }, [meets])

  const canCreateMeet = createEligibility?.canCreate === true

  const openDetails = (m: MeetRow) => {
    setSelectedMeet(m)
    setDetailsOpen(true)
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 w-full min-w-0 relative">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full" asChild>
            <Link href="/home" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-indigo-600" />
              Meets
            </h1>
          </div>
        </div>

        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="rounded-xl h-9 md:h-10 w-full sm:w-56">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="INTERVIEW">Interviews</SelectItem>
            <SelectItem value="MD_APPOINTMENT">MD appointments</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
          </SelectContent>
        </Select>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : meets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No meetings yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {[
              { key: 'today', label: 'Today', items: grouped.today },
              { key: 'tomorrow', label: 'Tomorrow', items: grouped.tomorrow },
              { key: 'week', label: 'This week', items: grouped.thisWeek },
              { key: 'later', label: 'Upcoming', items: grouped.later },
            ].map(
              (section) =>
                section.items.length > 0 && (
                  <section key={section.key}>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                      {section.label}
                    </h2>
                    <ul className="space-y-2">
                      {section.items.map((m) => {
                        const mine = myParticipationRow(m, user?.id)
                        const start = new Date(m.scheduledAt)
                        const end = m.endTime ? new Date(m.endTime) : null
                        const durMins = end
                          ? Math.max(0, differenceInMinutes(end, start))
                          : null
                        const attendance: 'joined' | 'missed' | null =
                          mine?.attended === true
                            ? 'joined'
                            : mine?.attended === false
                              ? 'missed'
                              : null
                        return (
                          <li key={m.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => openDetails(m)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openDetails(m)
                                }
                              }}
                              className={cn(
                                'relative w-full text-left block cursor-pointer touch-manipulation rounded-2xl border-2 bg-card overflow-hidden transition-colors active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                                isToday(start)
                                  ? 'border-indigo-200 dark:border-indigo-900'
                                  : 'border-border'
                              )}
                            >
                              {attendance && (
                                <span
                                  className={cn(
                                    'absolute top-3 right-3 h-2 w-2 rounded-full',
                                    attendance === 'joined'
                                      ? 'bg-emerald-500'
                                      : 'bg-rose-500'
                                  )}
                                  aria-label={
                                    attendance === 'joined' ? 'You joined' : 'You did not join'
                                  }
                                />
                              )}
                              <div className="p-3 pr-6">
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                      <Badge
                                        className={cn(
                                          'text-[10px] font-semibold uppercase tracking-wide',
                                          moduleBadgeClass(m.module)
                                        )}
                                      >
                                        {moduleLabel(m.module)}
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px]',
                                          m.type === 'VIRTUAL'
                                            ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300'
                                            : 'border-amber-400 text-amber-800 dark:text-amber-200'
                                        )}
                                      >
                                        {m.type === 'VIRTUAL' ? (
                                          <span className="flex items-center gap-0.5">
                                            <Video className="h-3 w-3" /> Virtual
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-0.5">
                                            <MapPin className="h-3 w-3" /> Offline
                                          </span>
                                        )}
                                      </Badge>
                                    </div>
                                    <p className="font-semibold text-sm leading-snug line-clamp-2">
                                      {m.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                                      <span>{format(start, 'EEE, MMM d · h:mm a')}</span>
                                      {durMins != null && (
                                        <>
                                          <span aria-hidden>·</span>
                                          <span className="inline-flex items-center gap-0.5">
                                            <Clock className="h-3 w-3" />
                                            {formatDurationShort(durMins)}
                                          </span>
                                        </>
                                      )}
                                    </p>
                                    {(m.location || m.type === 'VIRTUAL') && (
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {m.type === 'OFFLINE' && m.location ? m.location : null}
                                        {m.type === 'VIRTUAL' && !m.meetLink && 'No link yet'}
                                      </p>
                                    )}
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                      {meetRequesterLabel(m)}
                                    </p>
                                  </div>
                                  <div
                                    className="flex flex-col items-end gap-1.5 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {m.type === 'VIRTUAL' && m.meetLink && (
                                      <Button
                                        size="sm"
                                        className="h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                                        asChild
                                      >
                                        <a
                                          href={m.meetLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Join
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight
                                className="absolute right-1.5 bottom-3 h-4 w-4 text-muted-foreground/60 pointer-events-none"
                                aria-hidden
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
            )}
          </div>
        )}

        {canCreateMeet && (
          <>
            <Button
              type="button"
              size="icon"
              className="fixed z-40 h-14 w-14 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-6"
              aria-label="New meet"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-7 w-7" />
            </Button>
            <CreateMeetDrawer open={createOpen} onOpenChange={setCreateOpen} />
          </>
        )}

        <MeetDetailsDrawer
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          meet={selectedMeet as MeetDetailsMeet | null}
          currentUserId={user?.id}
        />
      </div>
    </AuthenticatedLayout>
  )
}
