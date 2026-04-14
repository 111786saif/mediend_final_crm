'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  ChevronRight,
  MapPin,
  Search,
  User,
  Video,
  X,
  Check,
  Clock,
  UserPlus,
} from 'lucide-react'
import { isValid } from 'date-fns'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { useAuth } from '@/hooks/use-auth'
import { useAssignableUsers } from '@/hooks/use-tasks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getAvatarColor } from '@/lib/avatar-colors'
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

type MeetCreatePayload = {
  title: string
  description?: string | null
  type: 'VIRTUAL' | 'OFFLINE'
  meetLink?: string | null
  location?: string | null
  scheduledAt: string
  endTime?: string | null
  module: 'GENERAL'
  participantUserIds: string[]
  candidateName?: string | null
  candidatePhone?: string | null
}

type FieldErrors = Partial<
  Record<
    | 'title'
    | 'scheduledAt'
    | 'meetLink'
    | 'location'
    | 'description'
    | 'candidateName'
    | 'candidatePhone'
    | 'duration',
    string
  >
>

const DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
]

export interface CreateMeetDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateMeetDrawer({ open, onOpenChange, onSuccess }: CreateMeetDrawerProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined)
  const [durationMins, setDurationMins] = useState<number | null>(null)
  const [customDuration, setCustomDuration] = useState('')
  const [showCustomDuration, setShowCustomDuration] = useState(false)
  const [meetType, setMeetType] = useState<'VIRTUAL' | 'OFFLINE'>('OFFLINE')
  const [location, setLocation] = useState('')
  const [meetLink, setMeetLink] = useState('')
  const [participantIds, setParticipantIds] = useState<Set<string>>(() => new Set())
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [showGuest, setShowGuest] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<'people' | null>(null)
  const [peopleSearch, setPeopleSearch] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const { data: inviteable = [] } = useAssignableUsers()

  const reset = useCallback(() => {
    setTitle('')
    setDescription('')
    setScheduledAt(undefined)
    setDurationMins(null)
    setCustomDuration('')
    setShowCustomDuration(false)
    setMeetType('OFFLINE')
    setLocation('')
    setMeetLink('')
    setParticipantIds(new Set())
    setGuestName('')
    setGuestPhone('')
    setShowGuest(false)
    setPickerOpen(null)
    setPeopleSearch('')
    setErrors({})
  }, [])

  useEffect(() => {
    if (open) {
      reset()
      setTimeout(() => titleRef.current?.focus(), 300)
    }
  }, [open, reset])

  const clearError = (field: keyof FieldErrors) => {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const createMutation = useMutation({
    mutationFn: (body: MeetCreatePayload) => apiPost<unknown>('/api/meets', body),
    onSuccess: () => {
      toast.success('Meet created')
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      onOpenChange(false)
      reset()
      onSuccess?.()
    },
    onError: (err: Error & { field?: string }) => {
      if (err.field && isKnownField(err.field)) {
        setErrors((prev) => ({ ...prev, [err.field as keyof FieldErrors]: err.message }))
        toast.error(err.message)
      } else {
        toast.error(err.message || 'Failed to create meet')
      }
    },
  })

  const filteredPeople = useMemo(() => {
    const others = inviteable.filter((u) => u.id !== user?.id)
    if (!peopleSearch.trim()) return others
    const q = peopleSearch.trim().toLowerCase()
    return others.filter(
      (u) =>
        (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
    )
  }, [inviteable, user?.id, peopleSearch])

  const selectedSummary = useMemo(() => {
    if (participantIds.size === 0) return undefined
    if (participantIds.size <= 2) {
      const names = [...participantIds]
        .map((id) => inviteable.find((u) => u.id === id)?.name ?? id)
        .join(', ')
      return names
    }
    return `${participantIds.size} people`
  }, [participantIds, inviteable])

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const effectiveDuration: number | null = useMemo(() => {
    if (showCustomDuration) {
      const n = parseInt(customDuration, 10)
      if (!Number.isFinite(n) || n < 5 || n > 480) return null
      return n
    }
    return durationMins
  }, [showCustomDuration, customDuration, durationMins])

  const durationLabel = useMemo(() => {
    const m = effectiveDuration
    if (!m) return null
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const mm = m % 60
    return mm === 0 ? `${h} h` : `${h} h ${mm} min`
  }, [effectiveDuration])

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!title.trim()) e.title = 'Title is required'
    if (!scheduledAt || !isValid(scheduledAt)) e.scheduledAt = 'Choose a date and time'
    else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (scheduledAt < today) e.scheduledAt = 'Cannot schedule a meet in the past'
    }
    if (meetType === 'VIRTUAL' && meetLink.trim() && !/^https?:\/\//i.test(meetLink.trim())) {
      e.meetLink = 'Link must start with http:// or https://'
    }
    if (meetType === 'OFFLINE' && !location.trim()) {
      e.location = 'Venue is required for offline meets'
    }
    if (description.length > 5000) {
      e.description = 'Agenda is too long (max 5000 characters)'
    }
    if (showCustomDuration) {
      const n = parseInt(customDuration, 10)
      if (!customDuration.trim()) {
        e.duration = 'Enter a duration in minutes'
      } else if (!Number.isFinite(n) || n < 5 || n > 480) {
        e.duration = 'Duration must be between 5 and 480 minutes'
      }
    }
    if (guestPhone.trim() && !/^\d{10}$/.test(guestPhone.trim())) {
      e.candidatePhone = 'Phone must be exactly 10 digits'
    }
    if (guestPhone.trim() && !guestName.trim()) {
      e.candidateName = 'Guest name is required when a phone is provided'
    }
    return e
  }

  const handleSubmit = () => {
    const v = validate()
    if (Object.keys(v).length > 0) {
      setErrors(v)
      return
    }
    setErrors({})

    const iso = (scheduledAt as Date).toISOString()
    const linkTrim = meetLink.trim()
    const endIso =
      effectiveDuration != null && scheduledAt
        ? new Date(scheduledAt.getTime() + effectiveDuration * 60_000).toISOString()
        : null

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      type: meetType,
      meetLink: meetType === 'VIRTUAL' ? linkTrim || null : null,
      location: meetType === 'OFFLINE' ? location.trim() || null : null,
      scheduledAt: iso,
      endTime: endIso,
      module: 'GENERAL',
      participantUserIds: [...participantIds],
      candidateName: guestName.trim() || null,
      candidatePhone: guestPhone.trim() || null,
    })
  }

  const canSubmit = !createMutation.isPending

  const RowButton = ({
    icon: Icon,
    label,
    value,
    accent,
    valueColor,
    onClick,
  }: {
    icon: React.ElementType
    label: string
    value?: string
    accent?: boolean
    valueColor?: string
    onClick: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[52px] w-full items-center gap-4 border-b border-border py-4 px-4 text-left text-base touch-manipulation active:bg-muted/50'
      )}
    >
      <Icon className={cn('h-6 w-6 shrink-0', valueColor ?? 'text-muted-foreground')} aria-hidden />
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-medium',
          valueColor ?? (accent ? 'text-primary' : '')
        )}
      >
        {value ?? label}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent
          className={cn(
            'inset-x-0 bottom-0 mt-0 flex h-dvh max-h-dvh flex-col rounded-t-2xl border-t border-border bg-card',
            '[&>div:first-child]:hidden'
          )}
        >
          <DrawerHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-4">
            <DrawerTitle className="text-xl font-semibold">New meet</DrawerTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </DrawerHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col pb-4">
              <div className="border-b border-border px-4 py-4">
                <Input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (errors.title) clearError('title')
                  }}
                  placeholder="Title"
                  aria-invalid={!!errors.title}
                  className={cn(
                    'text-xl font-semibold border-0 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground min-h-[48px]',
                    errors.title && 'text-rose-700'
                  )}
                  aria-label="Meet title"
                />
                {errors.title && <FieldError message={errors.title} />}
              </div>

              <div className="border-b border-border px-4 py-3">
                <Label className="text-xs text-muted-foreground">Agenda (optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (errors.description) clearError('description')
                  }}
                  placeholder="What's this meet about?"
                  aria-invalid={!!errors.description}
                  className="mt-1 border-0 px-0 shadow-none focus-visible:ring-0"
                />
                {errors.description && <FieldError message={errors.description} />}
                {description.length > 4500 && !errors.description && (
                  <p className="mt-1 text-[11px] text-muted-foreground text-right">
                    {description.length}/5000
                  </p>
                )}
              </div>

              <div className="border-b border-border px-4 py-3">
                <Label id="meet-when-label" className="text-xs text-muted-foreground">
                  When *
                </Label>
                <div className="mt-1">
                  <DateTimePicker
                    nested
                    disablePast
                    value={scheduledAt}
                    onChange={(d) => {
                      setScheduledAt(d)
                      if (errors.scheduledAt) clearError('scheduledAt')
                    }}
                    aria-labelledby="meet-when-label"
                    className={cn(
                      'rounded-xl min-h-11 h-auto py-2.5',
                      errors.scheduledAt && 'border-rose-400 ring-1 ring-rose-300'
                    )}
                  />
                </div>
                {errors.scheduledAt && <FieldError message={errors.scheduledAt} />}
              </div>

              <div className="border-b border-border px-4 py-3">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Duration {durationLabel && <span className="text-indigo-600 font-medium">· {durationLabel}</span>}
                </Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((p) => {
                    const active = !showCustomDuration && durationMins === p.minutes
                    return (
                      <button
                        key={p.minutes}
                        type="button"
                        onClick={() => {
                          setDurationMins(p.minutes)
                          setShowCustomDuration(false)
                          if (errors.duration) clearError('duration')
                        }}
                        className={cn(
                          'rounded-full border px-3.5 py-1.5 text-sm font-medium touch-manipulation transition-colors',
                          active
                            ? 'border-indigo-500 bg-indigo-600 text-white'
                            : 'border-border bg-muted/40 text-foreground active:bg-muted'
                        )}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomDuration(true)
                      setDurationMins(null)
                    }}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm font-medium touch-manipulation transition-colors',
                      showCustomDuration
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-border bg-muted/40 text-foreground active:bg-muted'
                    )}
                  >
                    Custom
                  </button>
                </div>
                {showCustomDuration && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min={5}
                      max={480}
                      value={customDuration}
                      onChange={(e) => {
                        setCustomDuration(e.target.value)
                        if (errors.duration) clearError('duration')
                      }}
                      placeholder="Minutes (5–480)"
                      className="rounded-xl h-10 max-w-[180px]"
                      aria-invalid={!!errors.duration}
                    />
                    <span className="text-xs text-muted-foreground">minutes</span>
                  </div>
                )}
                {errors.duration && <FieldError message={errors.duration} />}
              </div>

              <RowButton
                icon={User}
                label="Add people"
                value={selectedSummary}
                accent={participantIds.size > 0}
                valueColor={
                  participantIds.size > 0 ? 'text-indigo-600 dark:text-indigo-400' : undefined
                }
                onClick={() => setPickerOpen('people')}
              />

              <div className="border-b border-border px-4 py-3">
                <p className="text-sm text-muted-foreground mb-2">Format</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={meetType === 'OFFLINE' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      setMeetType('OFFLINE')
                      clearError('meetLink')
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-1.5" />
                    Offline
                  </Button>
                  <Button
                    type="button"
                    variant={meetType === 'VIRTUAL' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      setMeetType('VIRTUAL')
                      clearError('location')
                    }}
                  >
                    <Video className="h-4 w-4 mr-1.5" />
                    Virtual
                  </Button>
                </div>
              </div>

              {meetType === 'OFFLINE' && (
                <div className="border-b border-border px-4 py-3">
                  <Label className="text-xs text-muted-foreground">Venue *</Label>
                  <Input
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value)
                      if (errors.location) clearError('location')
                    }}
                    placeholder="Room or address"
                    aria-invalid={!!errors.location}
                    className={cn(
                      'mt-1 rounded-xl',
                      errors.location && 'border-rose-400 focus-visible:ring-rose-300'
                    )}
                  />
                  {errors.location && <FieldError message={errors.location} />}
                </div>
              )}

              {meetType === 'VIRTUAL' && (
                <div className="border-b border-border px-4 py-3">
                  <Label className="text-xs text-muted-foreground">Meet link (optional)</Label>
                  <Input
                    value={meetLink}
                    onChange={(e) => {
                      setMeetLink(e.target.value)
                      if (errors.meetLink) clearError('meetLink')
                    }}
                    placeholder="https://…"
                    aria-invalid={!!errors.meetLink}
                    className={cn(
                      'mt-1 rounded-xl',
                      errors.meetLink && 'border-rose-400 focus-visible:ring-rose-300'
                    )}
                  />
                  {errors.meetLink && <FieldError message={errors.meetLink} />}
                </div>
              )}

              {/* External guest */}
              <div className="border-b border-border px-4 py-3">
                {!showGuest ? (
                  <button
                    type="button"
                    onClick={() => setShowGuest(true)}
                    className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground active:text-foreground touch-manipulation"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add guest / external contact (optional)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Guest / external contact</Label>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground active:text-foreground"
                        onClick={() => {
                          setShowGuest(false)
                          setGuestName('')
                          setGuestPhone('')
                          clearError('candidateName')
                          clearError('candidatePhone')
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <Input
                        value={guestName}
                        onChange={(e) => {
                          setGuestName(e.target.value)
                          if (errors.candidateName) clearError('candidateName')
                        }}
                        placeholder="Guest name"
                        aria-invalid={!!errors.candidateName}
                        className={cn(
                          'rounded-xl',
                          errors.candidateName && 'border-rose-400 focus-visible:ring-rose-300'
                        )}
                      />
                      {errors.candidateName && <FieldError message={errors.candidateName} />}
                    </div>
                    <div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={guestPhone}
                        onChange={(e) => {
                          setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                          if (errors.candidatePhone) clearError('candidatePhone')
                        }}
                        placeholder="10-digit phone"
                        aria-invalid={!!errors.candidatePhone}
                        className={cn(
                          'rounded-xl',
                          errors.candidatePhone && 'border-rose-400 focus-visible:ring-rose-300'
                        )}
                      />
                      {errors.candidatePhone && <FieldError message={errors.candidatePhone} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DrawerFooter className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              size="lg"
              className="w-full text-base font-medium h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {createMutation.isPending ? 'Creating…' : 'Create meet'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Sheet open={pickerOpen === 'people'} onOpenChange={(o) => !o && setPickerOpen(null)}>
        <SheetContent
          side="right"
          className="w-full max-w-full sm:max-w-md flex flex-col p-0 bg-card"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle className="text-xl font-semibold pr-8">People</SheetTitle>
            <p className="text-sm text-muted-foreground text-left font-normal">
              Tap to add or remove. They&apos;ll get a notification.
            </p>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                className="h-12 pl-10 text-base rounded-xl"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 pb-4 space-y-0.5">
              {filteredPeople.map((u) => {
                const selected = participantIds.has(u.id)
                const col = getAvatarColor(u.name ?? u.email ?? '?')
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={cn(
                      'flex w-full min-h-[52px] items-center gap-3 rounded-xl px-3 py-3 text-base text-left touch-manipulation',
                      selected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'active:bg-muted/50'
                    )}
                    onClick={() => toggleParticipant(u.id)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className={cn(col.bg, col.text, 'text-sm font-medium')}
                      >
                        {getInitials(u.name ?? u.email ?? '?')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 min-w-0 truncate font-medium">{u.name ?? u.email}</span>
                    {selected ? (
                      <Check className="h-5 w-5 shrink-0 text-indigo-600" />
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded border border-muted-foreground/30" />
                    )}
                  </button>
                )
              })}
              {filteredPeople.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No people match</p>
              )}
            </div>
          </ScrollArea>
          <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button className="w-full rounded-xl" onClick={() => setPickerOpen(null)}>
              Done
              {participantIds.size > 0 && (
                <span className="ml-1 text-white/90">({participantIds.size})</span>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400" role="alert">
      {message}
    </p>
  )
}

function isKnownField(f: string): f is keyof FieldErrors {
  return [
    'title',
    'scheduledAt',
    'meetLink',
    'location',
    'description',
    'candidateName',
    'candidatePhone',
    'duration',
  ].includes(f)
}
