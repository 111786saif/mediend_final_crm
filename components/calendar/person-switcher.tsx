'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { getAvatarColor } from '@/lib/avatar-colors'
import { cn } from '@/lib/utils'
import { useUserDirectory } from '@/hooks/use-calendar'
import { useAuth } from '@/hooks/use-auth'
import type { DirectoryUser } from '@/app/api/users/directory/route'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

export function PersonSwitcher({
  currentUserId,
  targetUserId,
  onChange,
  disabled = false,
}: {
  currentUserId: string
  targetUserId: string
  onChange: (userId: string) => void
  disabled?: boolean
}) {
  const { user } = useAuth()
  const isBD = user?.role === 'BD'
  const isSwitcherDisabled = disabled || isBD

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: directory = [], isLoading } = useUserDirectory()

  const selected: DirectoryUser | undefined = useMemo(
    () => directory.find((u) => u.id === targetUserId),
    [directory, targetUserId]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return directory
    return directory.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.designation ?? '').toLowerCase().includes(q) ||
        (u.department?.name ?? '').toLowerCase().includes(q)
    )
  }, [directory, query])

  const isMe = targetUserId === currentUserId
  const displayName = isMe ? 'My calendar' : selected?.name ?? 'Select person'
  const displaySub = isMe
    ? 'Viewing yourself'
    : selected?.designation || selected?.department?.name || selected?.role || ''

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => !isSwitcherDisabled && setOpen(true)}
        className={cn(
          'w-full h-auto justify-between rounded-2xl py-2.5 pl-2.5 pr-3',
          isSwitcherDisabled && 'cursor-default opacity-90 hover:bg-background'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback
              className={cn(
                'text-sm font-semibold',
                selected && getAvatarColor(selected.name).bg,
                selected && getAvatarColor(selected.name).text
              )}
            >
              {selected ? getInitials(selected.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            {displaySub && (
              <div className="truncate text-[11px] text-muted-foreground">{displaySub}</div>
            )}
          </div>
        </div>
        {!isSwitcherDisabled && <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </Button>

      {!isSwitcherDisabled && (
        <Drawer open={open} onOpenChange={setOpen} direction="bottom">
          <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh]">
            <DrawerHeader className="border-b">
              <DrawerTitle className="text-base">Pick someone</DrawerTitle>
            </DrawerHeader>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search name, role, department…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-2">
              <PersonRow
                isActive={isMe}
                name="My calendar"
                sub="Viewing yourself"
                onClick={() => {
                  onChange(currentUserId)
                  setOpen(false)
                }}
              />
              {isLoading && (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
              )}
              {filtered
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <PersonRow
                    key={u.id}
                    isActive={u.id === targetUserId}
                    name={u.name}
                    sub={u.designation || u.department?.name || u.role}
                    onClick={() => {
                      onChange(u.id)
                      setOpen(false)
                    }}
                  />
                ))}
              {!isLoading && filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No matches.
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  )
}

function PersonRow({
  name,
  sub,
  isActive,
  onClick,
}: {
  name: string
  sub?: string | null
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left touch-manipulation active:bg-muted/50 transition-colors',
        isActive && 'bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-300 dark:ring-indigo-700'
      )}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarFallback
          className={cn('text-sm font-semibold', getAvatarColor(name).bg, getAvatarColor(name).text)}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', isActive && 'text-indigo-700 dark:text-indigo-300')}>
          {name}
        </p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {isActive && <Check className="h-5 w-5 shrink-0 text-indigo-600" />}
    </button>
  )
}
