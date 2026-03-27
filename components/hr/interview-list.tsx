'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isPast } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  Building2,
  Calendar,
  ChevronRight,
  MapPin,
  Users,
  Video,
} from 'lucide-react'

export type InterviewMeet = {
  id: string
  title: string
  type: 'VIRTUAL' | 'OFFLINE'
  meetLink: string | null
  location: string | null
  scheduledAt: string
  interviewRound: number | null
  candidateName: string | null
  candidateRole: string | null
  notes: string | null
  resumeUrl: string | null
  isRecorded: boolean
  department: { id: string; name: string } | null
  createdBy: { id: string; name: string }
  participants: { user: { id: string; name: string; email: string } }[]
}

interface InterviewListProps {
  from?: string
  to?: string
}

export function InterviewList({ from, to }: InterviewListProps) {
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<InterviewMeet | null>(null)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    return p.toString()
  }, [from, to])

  const { data: interviews = [], isLoading } = useQuery<InterviewMeet[]>({
    queryKey: ['hr-interviews', qs],
    queryFn: () =>
      apiGet<InterviewMeet[]>(`/api/hr/interviews${qs ? `?${qs}` : ''}`),
  })

  const departments = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of interviews) {
      if (i.department) m.set(i.department.id, i.department.name)
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [interviews])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return interviews.filter((i) => {
      if (deptFilter !== 'all' && i.department?.id !== deptFilter) return false
      if (!q) return true
      const blob = [
        i.candidateName,
        i.candidateRole,
        i.title,
        i.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [interviews, deptFilter, search])

  if (isLoading) {
    return (
      <div className="grid gap-2 sm:gap-3">
        {[1, 2, 3].map((k) => (
          <div
            key={k}
            className="h-24 animate-pulse rounded-2xl bg-muted/80"
          />
        ))}
      </div>
    )
  }

  if (interviews.length === 0) {
    return (
      <Card className="border-dashed border-violet-300 bg-violet-500/5">
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          No interviews yet. Tap <strong>Schedule</strong> to add one.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Input
          placeholder="Search candidate, role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl h-9 sm:h-10 flex-1"
        />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="rounded-xl w-full sm:w-44 h-9 sm:h-10">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2 sm:gap-3 mt-3">
        {filtered.map((i) => {
          const past = isPast(new Date(i.scheduledAt))
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setDetail(i)}
              className="text-left w-full"
            >
              <Card
                className={cn(
                  'overflow-hidden border-2 transition-all hover:shadow-md rounded-2xl',
                  past
                    ? 'border-border/60 bg-muted/20 opacity-90'
                    : 'border-violet-200/80 bg-gradient-to-br from-white to-violet-50/80 dark:from-card dark:to-violet-950/30'
                )}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {i.isRecorded && (
                          <Badge className="rounded-full bg-amber-500 text-white text-[10px]">
                            Recorded
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full text-[10px]',
                            i.type === 'VIRTUAL'
                              ? 'border-indigo-400 text-indigo-700 dark:text-indigo-300'
                              : 'border-amber-400 text-amber-800 dark:text-amber-200'
                          )}
                        >
                          {i.type === 'VIRTUAL' ? (
                            <span className="flex items-center gap-0.5">
                              <Video className="h-3 w-3" /> Virtual
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> Walk-in
                            </span>
                          )}
                        </Badge>
                        {i.interviewRound != null && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            R{i.interviewRound}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        {i.candidateName || i.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {i.candidateRole}
                        {i.department ? ` · ${i.department.name}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-violet-600" />
                          {format(new Date(i.scheduledAt), 'EEE, MMM d · h:mm a')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-fuchsia-600" />
                          {i.participants.length} panel
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && interviews.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          No matches for filters.
        </p>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] overflow-y-auto rounded-t-2xl p-0"
        >
          {detail && (
            <>
              <SheetHeader className="px-3 pt-4 pb-2 border-b bg-muted/30">
                <SheetTitle className="text-left text-base">
                  {detail.candidateName || detail.title}
                </SheetTitle>
                <p className="text-sm text-muted-foreground text-left">
                  {detail.candidateRole}
                </p>
              </SheetHeader>
              <div className="px-3 py-3 space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge>{detail.type === 'VIRTUAL' ? 'Virtual' : 'Walk-in'}</Badge>
                  {detail.interviewRound != null && (
                    <Badge variant="outline">Round {detail.interviewRound}</Badge>
                  )}
                </div>
                {detail.department && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {detail.department.name}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">When: </span>
                  {format(new Date(detail.scheduledAt), 'PPpp')}
                </div>
                {detail.location && (
                  <div>
                    <span className="text-muted-foreground">Location: </span>
                    {detail.location}
                  </div>
                )}
                {detail.meetLink && (
                  <Button asChild size="sm" className="rounded-xl w-full">
                    <a href={detail.meetLink} target="_blank" rel="noreferrer">
                      Open meet link
                    </a>
                  </Button>
                )}
                {detail.notes && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Notes</p>
                    <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-2 text-xs">
                      {detail.notes}
                    </p>
                  </div>
                )}
                {detail.resumeUrl && (
                  <Button asChild variant="outline" size="sm" className="rounded-xl w-full">
                    <a href={detail.resumeUrl} target="_blank" rel="noreferrer">
                      View resume
                    </a>
                  </Button>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Panel</p>
                  <ul className="text-xs space-y-1">
                    {detail.participants.map((p) => (
                      <li key={p.user.id}>{p.user.name}</li>
                    ))}
                    {detail.participants.length === 0 && (
                      <li className="text-muted-foreground">No panelists</li>
                    )}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created by {detail.createdBy.name}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
