'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search, Users } from 'lucide-react'
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
import { useTeamBds } from '@/hooks/use-calendar'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '?'
}

/**
 * Lets TL / ACM / CM / Sales Head filter the IPD calendar down to specific
 * BDs on their team. Empty selection = all team BDs (default).
 */
export function BdFilter({
  selectedIds,
  onChange,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: bds = [], isLoading } = useTeamBds()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bds
    return bds.filter((b) => b.name.toLowerCase().includes(q))
  }, [bds, query])

  const allSelected = selectedIds.length === 0
  const label = allSelected
    ? 'All BDs'
    : selectedIds.length === 1
      ? bds.find((b) => b.id === selectedIds[0])?.name ?? '1 BD'
      : `${selectedIds.length} BDs`

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full h-auto justify-between rounded-2xl py-2.5 pl-3 pr-3"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">{label}</span>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen} direction="bottom">
        <DrawerContent className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh]">
          <DrawerHeader className="border-b">
            <DrawerTitle className="text-base">Filter by BD</DrawerTitle>
          </DrawerHeader>
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search BD…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-2">
            <BdRow
              isActive={allSelected}
              name="All BDs"
              sub="Show the whole team"
              onClick={() => {
                onChange([])
                setOpen(false)
              }}
            />
            {isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {filtered.map((b) => (
              <BdRow
                key={b.id}
                isActive={selectedIds.includes(b.id)}
                name={b.name}
                onClick={() => toggle(b.id)}
              />
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {bds.length === 0 ? 'No BDs in your team yet.' : 'No matches.'}
              </div>
            )}
          </div>
          {!allSelected && (
            <div className="border-t p-3">
              <Button className="w-full rounded-xl" onClick={() => setOpen(false)}>
                Apply ({selectedIds.length} selected)
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}

function BdRow({
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
        'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left touch-manipulation active:bg-muted/50 transition-colors',
        isActive && 'bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-300 dark:ring-indigo-700'
      )}
    >
      <Avatar className="size-9 shrink-0">
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