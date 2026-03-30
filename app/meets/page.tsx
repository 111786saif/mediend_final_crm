'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { format, isThisWeek, isToday, isTomorrow } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CreateMeetDrawer } from '@/components/meets/create-meet-drawer'
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
import { ArrowLeft, FileText, MapPin, Video, CalendarDays, Plus } from 'lucide-react'

type MeetRow = {
  id: string
  title: string
  type: 'VIRTUAL' | 'OFFLINE'
  meetLink: string | null
  location: string | null
  scheduledAt: string
  module: 'INTERVIEW' | 'MD_APPOINTMENT' | 'GENERAL'
  candidateName: string | null
  resumeUrl: string | null
  createdBy: { name: string }
  mdAppointment?: {
    employee?: { user?: { name: string } | null } | null
  } | null
}

/** MD appointment meets are created by the MD; show the employee who requested the slot. */
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
      return 'bg-slate-600 text-white border-0'
  }
}

type CanCreateResponse = { canCreate: boolean }

export default function MeetsPage() {
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)

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
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
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
                      {section.items.map((m) => (
                        <li key={m.id}>
                          <Card
                            className={cn(
                              'overflow-hidden border-2 rounded-2xl',
                              isToday(new Date(m.scheduledAt))
                                ? 'border-indigo-200 dark:border-indigo-900'
                                : 'border-border'
                            )}
                          >
                            <CardContent className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                  <Badge className={cn('text-[10px]', moduleBadgeClass(m.module))}>
                                    {moduleLabel(m.module)}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px]',
                                      m.type === 'VIRTUAL'
                                        ? 'border-indigo-400 text-indigo-700'
                                        : 'border-amber-400 text-amber-800'
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
                                <p className="font-semibold text-sm leading-tight">
                                  {m.candidateName ? `${m.title}` : m.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(m.scheduledAt), 'EEE, MMM d · h:mm a')}
                                  <span className="mx-1">·</span>
                                  {meetRequesterLabel(m)}
                                </p>
                                {m.location && (
                                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                                    {m.location}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                                {m.meetLink && (
                                  <Button size="sm" className="rounded-xl w-full sm:w-auto" asChild>
                                    <a href={m.meetLink} target="_blank" rel="noreferrer">
                                      Join
                                    </a>
                                  </Button>
                                )}
                                {m.module === 'INTERVIEW' && m.resumeUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl w-full sm:w-auto gap-1.5"
                                    asChild
                                  >
                                    <a href={m.resumeUrl} target="_blank" rel="noreferrer">
                                      <FileText className="h-3.5 w-3.5 shrink-0" />
                                      Resume
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
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
      </div>
    </AuthenticatedLayout>
  )
}
