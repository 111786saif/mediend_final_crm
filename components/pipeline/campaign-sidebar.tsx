'use client'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'

export type SidebarGroupMode = 'circle' | 'disease'

export type CampaignSelection =
  | { type: 'all' }
  | { type: 'campaign'; groupBy: SidebarGroupMode; groupValue: string; campaignLabel: string }

const CIRCLE_DOT: Record<string, string> = {
  Delhi: '#007AFF',
  Hyderabad: '#AF52DE',
  Lucknow: '#FF9500',
  Mumbai: '#34C759',
  Pune: '#FF3B30',
}

function normalizedText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return (trimmed || fallback).replace(/\s+/g, ' ')
}

function groupLabelForMode(mode: SidebarGroupMode) {
  return mode === 'circle' ? 'Circles' : 'Diseases'
}

function groupValueForLead(
  lead: { circle?: string | null; treatment?: string | null },
  mode: SidebarGroupMode
): string {
  return mode === 'circle'
    ? normalizedText(lead.circle, 'Unknown')
    : normalizedText(lead.treatment, 'Unknown disease')
}

function dotForCircle(circle: string) {
  const k = Object.keys(CIRCLE_DOT).find((c) => c.toLowerCase() === circle.trim().toLowerCase())
  return k ? CIRCLE_DOT[k] : '#8E8E93'
}

export function buildCampaignTree(
  leads: { circle?: string | null; campaignName?: string | null; treatment?: string | null }[],
  groupBy: SidebarGroupMode
) {
  const map = new Map<string, Map<string, number>>()
  for (const l of leads) {
    const groupValue = groupValueForLead(l, groupBy)
    const campaign = normalizedText(l.campaignName, 'No campaign')
    if (!map.has(groupValue)) map.set(groupValue, new Map())
    const inner = map.get(groupValue)!
    inner.set(campaign, (inner.get(campaign) ?? 0) + 1)
  }
  const groups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  return groups.map(([groupValue, campaigns]) => ({
    groupValue,
    total: [...campaigns.values()].reduce((s, n) => s + n, 0),
    campaigns: [...campaigns.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
  }))
}

function buildTreeFingerprint(
  leads: { circle?: string | null; campaignName?: string | null; treatment?: string | null }[],
  groupBy: SidebarGroupMode
): string {
  const map = new Map<string, number>()
  for (const l of leads) {
    const key = `${groupValueForLead(l, groupBy)}\t${normalizedText(l.campaignName, 'No campaign')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|')
}

export const CampaignSidebar = memo(function CampaignSidebar({
  leads = [],
  tree: treeProp,
  totalLeads: totalLeadsProp,
  groupBy,
  onGroupByChange,
  selection,
  onSelect,
  collapsed,
  onCollapsedChange,
  isLoading = false,
  className,
}: {
  leads?: { circle?: string | null; campaignName?: string | null; treatment?: string | null }[]
  /** Prefetched server-side campaign tree (preferred for large datasets). */
  tree?: ReturnType<typeof buildCampaignTree>
  totalLeads?: number
  groupBy: SidebarGroupMode
  onGroupByChange: (value: SidebarGroupMode) => void
  selection: CampaignSelection
  onSelect: (s: CampaignSelection) => void
  collapsed: boolean
  onCollapsedChange: (next: boolean) => void
  isLoading?: boolean
  className?: string
}) {
  const fingerprint = useMemo(
    () => (treeProp ? '' : buildTreeFingerprint(leads, groupBy)),
    [leads, groupBy, treeProp],
  )
  const prevRef = useRef<{ fp: string; tree: ReturnType<typeof buildCampaignTree> }>({ fp: '', tree: [] })
  const tree = useMemo(() => {
    if (treeProp) return treeProp
    if (prevRef.current.fp === fingerprint) return prevRef.current.tree
    const built = buildCampaignTree(leads, groupBy)
    prevRef.current = { fp: fingerprint, tree: built }
    return built
  }, [fingerprint, groupBy, leads, treeProp])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = {}
      for (const { groupValue } of tree) next[groupValue] = prev[groupValue] ?? true
      return next
    })
  }, [tree])

  const totalLeads = totalLeadsProp ?? leads.length
  const groupLabel = groupLabelForMode(groupBy)

  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border/60 bg-muted/30 py-3 transition-[width] duration-200',
        collapsed ? 'w-[64px] px-2' : 'w-[280px] px-2',
        className
      )}
    >
      <div className="flex items-center gap-2 px-1 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
        {!collapsed && (
          <Select value={groupBy} onValueChange={(value) => onGroupByChange(value as SidebarGroupMode)}>
            <SelectTrigger className="h-8 flex-1 bg-background">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="circle">Circle</SelectItem>
              <SelectItem value="disease">Disease</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {collapsed ? (
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <div className="rounded-full bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {groupBy === 'circle' ? 'C' : 'D'}
          </div>
          <div className="rounded-xl border border-border/70 bg-background px-2 py-2 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{groupLabel}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{totalLeads}</p>
          </div>
          <Button
            type="button"
            variant={selection.type === 'all' ? 'default' : 'outline'}
            className="h-auto w-full px-1 py-2 text-[11px]"
            onClick={() => onSelect({ type: 'all' })}
          >
            All
          </Button>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{groupLabel}</p>
          <button
            type="button"
            onClick={() => onSelect({ type: 'all' })}
            className={cn(
              'mb-2 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors',
              selection.type === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/80'
            )}
          >
            <span>All leads</span>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                selection.type === 'all'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {totalLeads}
            </span>
          </button>

          <div className="flex-1 overflow-y-auto pr-1">
            {isLoading && tree.length === 0 ? (
              <div className="space-y-2 px-1 py-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : null}
            {tree.map(({ groupValue, total, campaigns }) => {
              const open = openGroups[groupValue] ?? true
              const isCircleMode = groupBy === 'circle'
              return (
                <div key={groupValue} className="mb-0.5">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
                    onClick={() => setOpenGroups((p) => ({ ...p, [groupValue]: !open }))}
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: isCircleMode ? dotForCircle(groupValue) : '#6366F1' }}
                    />
                    <span className="flex-1 truncate text-[13px] font-semibold text-foreground/90">{groupValue}</span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {total}
                    </span>
                  </button>
                  {open && (
                    <div className="ml-1 space-y-0.5 border-l border-border/50 pl-2">
                      {campaigns.map(({ name, count }) => {
                        const key = `${groupValue}\t${name}`
                        const isActive =
                          selection.type === 'campaign' &&
                          selection.groupBy === groupBy &&
                          selection.groupValue === groupValue &&
                          selection.campaignLabel === name
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => onSelect({ type: 'campaign', groupBy, groupValue, campaignLabel: name })}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-all',
                              isActive
                                ? 'bg-primary font-medium text-primary-foreground shadow-md shadow-primary/20'
                                : 'text-foreground/80 hover:bg-muted/70'
                            )}
                          >
                            <span className="line-clamp-2 flex-1">{name}</span>
                            <span
                              className={cn(
                                'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                                isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'text-primary'
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
})
