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
import { ChevronRight, MapPin, Search, User, Video, X, Check } from 'lucide-react'
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
  module: 'GENERAL'
  participantUserIds: string[]
}

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
  const [meetType, setMeetType] = useState<'VIRTUAL' | 'OFFLINE'>('OFFLINE')
  const [location, setLocation] = useState('')
  const [meetLink, setMeetLink] = useState('')
  const [participantIds, setParticipantIds] = useState<Set<string>>(() => new Set())
  const [pickerOpen, setPickerOpen] = useState<'people' | null>(null)
  const [peopleSearch, setPeopleSearch] = useState('')

  const { data: inviteable = [] } = useAssignableUsers()

  const reset = useCallback(() => {
    setTitle('')
    setDescription('')
    setScheduledAt(undefined)
    setMeetType('OFFLINE')
    setLocation('')
    setMeetLink('')
    setParticipantIds(new Set())
    setPickerOpen(null)
    setPeopleSearch('')
  }, [])

  useEffect(() => {
    if (open) {
      reset()
      setTimeout(() => titleRef.current?.focus(), 300)
    }
  }, [open, reset])

  const createMutation = useMutation({
    mutationFn: (body: MeetCreatePayload) => apiPost<unknown>('/api/meets', body),
    onSuccess: () => {
      toast.success('Meet created')
      queryClient.invalidateQueries({ queryKey: ['meets'] })
      onOpenChange(false)
      reset()
      onSuccess?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create meet')
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

  const linkOk =
    meetType !== 'VIRTUAL' ||
    !meetLink.trim() ||
    /^https?:\/\//i.test(meetLink.trim())
  const hasWhen = Boolean(scheduledAt && isValid(scheduledAt))
  const canSubmit =
    !!title.trim() && hasWhen && !createMutation.isPending && linkOk

  const handleSubmit = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    if (!scheduledAt || !isValid(scheduledAt)) {
      toast.error('Choose date and time')
      return
    }
    const iso = scheduledAt.toISOString()
    const linkTrim = meetLink.trim()
    if (meetType === 'VIRTUAL' && linkTrim && !/^https?:\/\//i.test(linkTrim)) {
      toast.error('Meet link must start with http:// or https://')
      return
    }

    createMutation.mutate({
      title: trimmedTitle,
      description: description.trim() || null,
      type: meetType,
      meetLink: meetType === 'VIRTUAL' ? linkTrim || null : null,
      location: meetType === 'OFFLINE' ? location.trim() || null : null,
      scheduledAt: iso,
      module: 'GENERAL',
      participantUserIds: [...participantIds],
    })
  }

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
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  className="text-xl font-semibold border-0 px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground min-h-[48px]"
                  aria-label="Meet title"
                />
              </div>
              <div className="border-b border-border px-4 py-3">
                <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agenda or notes"
                  className="mt-1 border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="border-b border-border px-4 py-3">
                <Label id="meet-when-label" className="text-xs text-muted-foreground">
                  When *
                </Label>
                <div className="mt-1">
                  <DateTimePicker
                    nested
                    value={scheduledAt}
                    onChange={setScheduledAt}
                    aria-labelledby="meet-when-label"
                    className="rounded-xl min-h-11 h-auto py-2.5"
                  />
                </div>
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
                    onClick={() => setMeetType('OFFLINE')}
                  >
                    <MapPin className="h-4 w-4 mr-1.5" />
                    Offline
                  </Button>
                  <Button
                    type="button"
                    variant={meetType === 'VIRTUAL' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl"
                    onClick={() => setMeetType('VIRTUAL')}
                  >
                    <Video className="h-4 w-4 mr-1.5" />
                    Virtual
                  </Button>
                </div>
              </div>
              {meetType === 'OFFLINE' && (
                <div className="border-b border-border px-4 py-3">
                  <Label className="text-xs text-muted-foreground">Location (optional)</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Room or address"
                    className="mt-1 rounded-xl"
                  />
                </div>
              )}
              {meetType === 'VIRTUAL' && (
                <div className="border-b border-border px-4 py-3">
                  <Label className="text-xs text-muted-foreground">Meet link (optional)</Label>
                  <Input
                    value={meetLink}
                    onChange={(e) => setMeetLink(e.target.value)}
                    placeholder="https://…"
                    className="mt-1 rounded-xl"
                  />
                </div>
              )}
            </div>
          </ScrollArea>

          <DrawerFooter className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              size="lg"
              className="w-full text-base font-medium h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              Create meet
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
