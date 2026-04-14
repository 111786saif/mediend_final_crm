'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  X,
  MapPin,
  Video,
  Clock,
  Calendar,
  FileText,
  Phone,
  ExternalLink,
  UserCheck,
  UserX,
  ChevronLeft,
  Pencil,
  Users,
} from 'lucide-react'
import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  differenceInMinutes,
} from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getAvatarColor } from '@/lib/avatar-colors'

type Participant = {
  userId: string
  user?: { id: string; name: string; email: string } | null
  attended: boolean | null
  remarks: string | null
}

export type MeetDetailsMeet = {
  id: string
  title: string
  description?: string | null
  type: 'VIRTUAL' | 'OFFLINE'
  meetLink?: string | null
  location?: string | null
  scheduledAt: string
  endTime?: string | null
  module: 'INTERVIEW' | 'MD_APPOINTMENT' | 'GENERAL'
  candidateName?: string | null
  candidatePhone?: string | null
  candidateRole?: string | null
  resumeUrl?: string | null
  notes?: string | null
  createdBy: { id: string; name: string; email?: string }
  participants?: Participant[]
  mdAppointment?: {
    employee?: { user?: { name: string } | null } | null
  } | null
}

interface MeetDetailsDrawerProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  meet: MeetDetailsMeet | null
  currentUserId: string | undefined
}

type AccentTheme = {
  gradient: string
  pill: string
  ring: string
  primaryBtn: string
  softBg: string
  softText: string
  label: string
}

function themeFor(module: MeetDetailsMeet['module']): AccentTheme {
  switch (module) {
    case 'INTERVIEW':
      return {
        gradient: 'from-violet-600 via-violet-500 to-fuchsia-500',
        pill: 'bg-white/20 text-white border-white/30',
        ring: 'ring-violet-500/30',
        primaryBtn: 'bg-violet-600 hover:bg-violet-700 text-white',
        softBg: 'bg-violet-50 dark:bg-violet-950/30',
        softText: 'text-violet-700 dark:text-violet-300',
        label: 'Interview',
      }
    case 'MD_APPOINTMENT':
      return {
        gradient: 'from-amber-600 via-amber-500 to-orange-500',
        pill: 'bg-white/20 text-white border-white/30',
        ring: 'ring-amber-500/30',
        primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
        softBg: 'bg-amber-50 dark:bg-amber-950/30',
        softText: 'text-amber-800 dark:text-amber-200',
        label: 'MD appointment',
      }
    default:
      return {
        gradient: 'from-indigo-600 via-indigo-500 to-sky-500',
        pill: 'bg-white/20 text-white border-white/30',
        ring: 'ring-indigo-500/30',
        primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        softBg: 'bg-indigo-50 dark:bg-indigo-950/30',
        softText: 'text-indigo-700 dark:text-indigo-300',
        label: 'Meet',
      }
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function relativeLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  const now = new Date()
  if (date < now) return formatDistanceToNow(date, { addSuffix: true })
  return formatDistanceToNow(date, { addSuffix: true })
}

export function MeetDetailsDrawer({
  open,
  onOpenChange,
  meet,
  currentUserId,
}: MeetDetailsDrawerProps) {
  const queryClient = useQueryClient()
  const [remarksOpen, setRemarksOpen] = useState(false)
  const [remarksDraft, setRemarksDraft] = useState('')
  const [attendedDraft, setAttendedDraft] = useState<boolean | null>(null)

  const myRow = useMemo(() => {
    if (!meet || !currentUserId) return null
    return meet.participants?.find((p) => p.userId === currentUserId) ?? null
  }, [meet, currentUserId])

  useEffect(() => {
    if (remarksOpen && myRow) {
      setRemarksDraft(myRow.remarks ?? '')
      setAttendedDraft(myRow.attended ?? null)
    }
  }, [remarksOpen, myRow])

  const saveAttendance = useMutation({
    mutationFn: (body: { attended?: boolean; remarks?: string | null }) =>
      apiPatch<{ id: string; attended: boolean | null; remarks: string | null }>(
        `/api/meets/${meet?.id}/my-attendance`,
        body
      ),
    onSuccess: () => {
      toast.success('Saved')
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      setRemarksOpen(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
  })

  const quickMarkAttendance = useMutation({
    mutationFn: (attended: boolean) =>
      apiPatch<{ id: string; attended: boolean | null; remarks: string | null }>(
        `/api/meets/${meet?.id}/my-attendance`,
        { attended, remarks: myRow?.remarks ?? null }
      ),
    onSuccess: (_, attended) => {
      toast.success(attended ? 'Marked as joined' : 'Marked as not joined')
      queryClient.invalidateQueries({ queryKey: ['meets'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
  })

  if (!meet) return null

  const theme = themeFor(meet.module)
  const start = new Date(meet.scheduledAt)
  const end = meet.endTime ? new Date(meet.endTime) : null
  const durationMins = end ? Math.max(0, differenceInMinutes(end, start)) : null

  const isInterview = meet.module === 'INTERVIEW'
  const hasGuest = Boolean(meet.candidateName?.trim())
  const internalParticipants = (meet.participants ?? []).filter(
    (p) => p.user && p.userId !== meet.createdBy.id
  )

  const mapsHref = meet.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meet.location)}`
    : null

  const iAmParticipant = Boolean(myRow) || meet.createdBy.id === currentUserId

  const handleSaveRemarks = () => {
    const trimmed = remarksDraft.trim()
    if (attendedDraft === null && !trimmed) {
      toast.error('Choose joined or did not join, or add a remark')
      return
    }
    const payload: { attended?: boolean; remarks?: string | null } = { remarks: trimmed || null }
    if (attendedDraft !== null) payload.attended = attendedDraft
    saveAttendance.mutate(payload)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent
          className={cn(
            'inset-x-0 bottom-0 mt-0 flex h-[92dvh] max-h-[92dvh] flex-col rounded-t-2xl border-t border-border bg-background p-0 sm:mx-auto sm:max-w-xl',
            '[&>div:first-child]:bg-white/40'
          )}
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>{meet.title}</DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {/* Hero gradient */}
            <div className={cn('relative bg-gradient-to-br px-5 pb-6 pt-5 text-white', theme.gradient)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={cn('border text-[10px] font-semibold uppercase tracking-wide', theme.pill)}>
                    {theme.label}
                  </Badge>
                  <Badge className={cn('border text-[10px] font-semibold uppercase tracking-wide', theme.pill)}>
                    {meet.type === 'VIRTUAL' ? (
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" /> Virtual
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Offline
                      </span>
                    )}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <h2 className="mt-4 text-2xl font-bold leading-tight drop-shadow-sm">{meet.title}</h2>
              <p className="mt-1 text-sm text-white/85">
                Organized by <span className="font-medium">{meet.createdBy.name}</span>
              </p>
            </div>

            <div className="relative z-10 mt-4 space-y-4 px-4 pb-28">
              {/* Time + duration card */}
              <div className={cn('rounded-2xl border border-border bg-card p-4 shadow-lg ring-1', theme.ring)}>
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', theme.softBg)}>
                    <Calendar className={cn('h-5 w-5', theme.softText)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {relativeLabel(start)}
                    </p>
                    <p className="mt-0.5 text-base font-semibold leading-tight">
                      {format(start, 'EEE, MMM d · h:mm a')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {durationMins ? formatDuration(durationMins) : 'Duration not set'}
                      </span>
                      {end && (
                        <span className="text-muted-foreground">
                          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Venue / link */}
              {(meet.type === 'OFFLINE' && meet.location) || (meet.type === 'VIRTUAL' && meet.meetLink) ? (
                <div className="rounded-2xl border border-border bg-card p-4">
                  {meet.type === 'OFFLINE' && meet.location && (
                    <a
                      href={mapsHref ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 -m-1 rounded-xl p-1 touch-manipulation active:bg-muted/50"
                    >
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', theme.softBg)}>
                        <MapPin className={cn('h-5 w-5', theme.softText)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Venue</p>
                        <p className="mt-0.5 text-sm font-medium leading-snug break-words">{meet.location}</p>
                        <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1">
                          Open in Maps <ExternalLink className="h-3 w-3" />
                        </p>
                      </div>
                    </a>
                  )}
                  {meet.type === 'VIRTUAL' && meet.meetLink && (
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', theme.softBg)}>
                        <Video className={cn('h-5 w-5', theme.softText)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meeting link</p>
                        <p className="mt-0.5 text-sm font-medium leading-snug break-all text-foreground/90">
                          {meet.meetLink}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Agenda */}
              {meet.description?.trim() && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agenda</p>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {meet.description}
                  </p>
                </div>
              )}

              {/* Interview notes */}
              {isInterview && meet.notes?.trim() && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">{meet.notes}</p>
                </div>
              )}

              {/* People */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    People ({internalParticipants.length + 1 + (hasGuest ? 1 : 0)})
                  </p>
                </div>
                <ul className="mt-3 space-y-2">
                  <PersonRow
                    name={meet.createdBy.name}
                    subtitle="Organizer"
                    isOrganizer
                  />
                  {internalParticipants.map((p) => (
                    <PersonRow
                      key={p.userId}
                      name={p.user?.name ?? p.userId}
                      subtitle={p.user?.email ?? undefined}
                      attended={p.attended}
                    />
                  ))}
                  {hasGuest && (
                    <GuestRow
                      name={meet.candidateName ?? ''}
                      phone={meet.candidatePhone ?? null}
                      role={meet.candidateRole ?? null}
                      label={isInterview ? 'Candidate' : 'Guest'}
                    />
                  )}
                </ul>
              </div>

              {/* My remarks — only if I'm a participant */}
              {iAmParticipant && myRow && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Your remarks
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => setRemarksOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {myRow.remarks ? 'Edit' : 'Add'}
                    </Button>
                  </div>
                  {myRow.remarks ? (
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {myRow.remarks}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No remarks yet.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant={myRow.attended === true ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'flex-1 rounded-xl h-10',
                        myRow.attended === true && 'bg-emerald-600 hover:bg-emerald-700'
                      )}
                      disabled={quickMarkAttendance.isPending}
                      onClick={() => quickMarkAttendance.mutate(true)}
                    >
                      <UserCheck className="h-4 w-4 mr-1.5" />
                      Joined
                    </Button>
                    <Button
                      type="button"
                      variant={myRow.attended === false ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'flex-1 rounded-xl h-10',
                        myRow.attended === false && 'bg-rose-600 hover:bg-rose-700'
                      )}
                      disabled={quickMarkAttendance.isPending}
                      onClick={() => quickMarkAttendance.mutate(false)}
                    >
                      <UserX className="h-4 w-4 mr-1.5" />
                      Did not join
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <DrawerFooter className="border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-2">
              {meet.type === 'VIRTUAL' && meet.meetLink && (
                <Button asChild size="lg" className={cn('flex-1 rounded-xl h-12', theme.primaryBtn)}>
                  <a href={meet.meetLink} target="_blank" rel="noreferrer">
                    <Video className="h-4 w-4 mr-1.5" />
                    Join
                  </a>
                </Button>
              )}
              {meet.type === 'OFFLINE' && mapsHref && (
                <Button asChild size="lg" className={cn('flex-1 rounded-xl h-12', theme.primaryBtn)}>
                  <a href={mapsHref} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4 mr-1.5" />
                    Directions
                  </a>
                </Button>
              )}
              {isInterview && meet.resumeUrl && (
                <Button asChild variant="outline" size="lg" className="rounded-xl h-12">
                  <a href={meet.resumeUrl} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4 mr-1.5" />
                    Resume
                  </a>
                </Button>
              )}
              {!(meet.type === 'VIRTUAL' && meet.meetLink) && !(meet.type === 'OFFLINE' && mapsHref) && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 rounded-xl h-12"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Nested remarks editor */}
      <Sheet open={remarksOpen} onOpenChange={setRemarksOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 max-h-[92vh] sm:max-w-lg sm:mx-auto"
        >
          <SheetHeader className="flex flex-row items-center gap-2 border-b border-border px-2 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={() => setRemarksOpen(false)}
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 text-left">
              <SheetTitle className="text-lg font-semibold">Your remarks</SheetTitle>
              <p className="text-xs text-muted-foreground truncate">{meet.title}</p>
            </div>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Did you join?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={attendedDraft === true ? 'default' : 'outline'}
                  className={cn(
                    'h-12 rounded-xl',
                    attendedDraft === true && 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                  onClick={() => setAttendedDraft(true)}
                >
                  <UserCheck className="h-4 w-4 mr-1.5" />
                  Joined
                </Button>
                <Button
                  type="button"
                  variant={attendedDraft === false ? 'default' : 'outline'}
                  className={cn(
                    'h-12 rounded-xl',
                    attendedDraft === false && 'bg-rose-600 hover:bg-rose-700'
                  )}
                  onClick={() => setAttendedDraft(false)}
                >
                  <UserX className="h-4 w-4 mr-1.5" />
                  Did not join
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="meet-remarks-editor" className="text-sm font-medium">
                Remarks
              </Label>
              <Textarea
                id="meet-remarks-editor"
                value={remarksDraft}
                onChange={(e) => setRemarksDraft(e.target.value)}
                placeholder="Notes for you or your manager…"
                className="mt-2 min-h-[120px] rounded-xl text-base resize-y"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{remarksDraft.length}/2000</p>
            </div>
            <Button
              size="lg"
              className={cn('w-full h-12 rounded-xl', theme.primaryBtn)}
              disabled={saveAttendance.isPending}
              onClick={handleSaveRemarks}
            >
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function PersonRow({
  name,
  subtitle,
  attended,
  isOrganizer,
}: {
  name: string
  subtitle?: string
  attended?: boolean | null
  isOrganizer?: boolean
}) {
  const col = getAvatarColor(name)
  return (
    <li className="flex items-center gap-3">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className={cn(col.bg, col.text, 'text-sm font-medium')}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight truncate">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {isOrganizer ? (
        <Badge variant="secondary" className="text-[10px] rounded-full">
          Organizer
        </Badge>
      ) : attended === true ? (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0 text-[10px] rounded-full">
          Joined
        </Badge>
      ) : attended === false ? (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-0 text-[10px] rounded-full">
          Not joined
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] rounded-full text-muted-foreground">
          Not marked
        </Badge>
      )}
    </li>
  )
}

function GuestRow({
  name,
  phone,
  role,
  label,
}: {
  name: string
  phone: string | null
  role: string | null
  label: string
}) {
  const col = getAvatarColor(name)
  return (
    <li className="flex items-center gap-3 rounded-xl border border-dashed border-border p-2 -mx-1">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className={cn(col.bg, col.text, 'text-sm font-medium')}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium leading-tight truncate">{name}</p>
          <Badge variant="outline" className="text-[9px] rounded-full px-1.5 py-0 h-4">
            {label}
          </Badge>
        </div>
        {role && <p className="text-xs text-muted-foreground truncate">{role}</p>}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400"
          >
            <Phone className="h-3 w-3" />
            {phone}
          </a>
        )}
      </div>
    </li>
  )
}
