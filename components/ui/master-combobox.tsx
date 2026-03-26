'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export type MasterType = 'hospitals' | 'doctors' | 'tpas' | 'anesthesia'

const MASTER_PATH: Record<MasterType, string> = {
  hospitals: '/api/masters/hospitals',
  doctors: '/api/masters/doctors',
  tpas: '/api/masters/tpas',
  anesthesia: '/api/masters/anesthesia',
}

export interface MasterItem {
  id: string
  name: string
  address?: string | null
  googleMapLink?: string | null
  isActive: boolean
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export interface MasterComboboxProps {
  masterType: MasterType
  value: string
  onChange: (value: string) => void
  id?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
  className?: string
}

export function MasterCombobox({
  masterType,
  value,
  onChange,
  id,
  label,
  placeholder = 'Search or type a value…',
  disabled,
  required,
  error,
  className,
}: MasterComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  const debouncedSearch = useDebouncedValue(inputValue, 250)

  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const path = MASTER_PATH[masterType]
  const { data, isFetching } = useQuery({
    queryKey: ['masters', masterType, debouncedSearch],
    queryFn: async () => {
      const q = debouncedSearch.trim()
      const url = `${path}?search=${encodeURIComponent(q)}`
      return apiGet<{ items: MasterItem[] }>(url)
    },
    enabled: !disabled,
    staleTime: 30_000,
  })

  const items = React.useMemo(() => data?.items ?? [], [data])
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
  const prevDebouncedSearch = React.useRef(debouncedSearch)
  const itemKey = React.useMemo(() => items.map((x) => x.id).join('|'), [items])
  const listInstanceId = React.useId().replace(/:/g, '')

  React.useEffect(() => {
    if (!open) return
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch
      setHighlightedIndex(items.length > 0 ? 0 : -1)
      return
    }
    setHighlightedIndex((hi) => {
      if (items.length === 0) return -1
      return Math.min(Math.max(hi, 0), items.length - 1)
    })
  }, [open, debouncedSearch, itemKey, items.length])

  React.useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1)
      return
    }
    setHighlightedIndex((hi) => {
      if (items.length === 0) return -1
      if (hi >= 0 && hi < items.length) return hi
      return 0
    })
  }, [open, items.length, itemKey])

  React.useLayoutEffect(() => {
    if (!open || highlightedIndex < 0) return
    const el = document.querySelector(
      `[data-master-combobox-option="${listInstanceId}-${highlightedIndex}"]`
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIndex, listInstanceId, itemKey])

  const commitFreeText = React.useCallback(() => {
    const v = inputValue.trim()
    onChange(v)
    setOpen(false)
  }, [inputValue, onChange])

  const selectItem = (item: MasterItem) => {
    onChange(item.name)
    setInputValue(item.name)
    setOpen(false)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required ? ' *' : ''}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              id={id}
              value={inputValue}
              disabled={disabled}
              placeholder={placeholder}
              autoComplete="off"
              onChange={(e) => {
                setInputValue(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  commitFreeText()
                }, 150)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (!open) {
                    setOpen(true)
                    setHighlightedIndex(items.length > 0 ? 0 : -1)
                    return
                  }
                  if (items.length === 0) return
                  setHighlightedIndex((i) => {
                    const cur = i < 0 ? -1 : i
                    return (cur + 1) % items.length
                  })
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (!open) {
                    setOpen(true)
                    setHighlightedIndex(items.length > 0 ? items.length - 1 : -1)
                    return
                  }
                  if (items.length === 0) return
                  setHighlightedIndex((i) => {
                    const cur = i < 0 ? 0 : i
                    return (cur - 1 + items.length) % items.length
                  })
                  return
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (
                    open &&
                    highlightedIndex >= 0 &&
                    highlightedIndex < items.length &&
                    items[highlightedIndex]
                  ) {
                    selectItem(items[highlightedIndex])
                    return
                  }
                  if (items[0]) selectItem(items[0])
                  else commitFreeText()
                  return
                }
                if (e.key === 'Escape') {
                  setOpen(false)
                  setInputValue(value)
                }
              }}
              className={cn(error && 'border-destructive')}
            />
            {isFetching && (
              <Loader2 className="text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-anchor-width,24rem)] max-w-[min(100vw,32rem)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ScrollArea className="h-[min(280px,var(--radix-scroll-area-viewport-height))]">
            <div className="p-1">
              {items.length === 0 && !isFetching && (
                <p className="text-muted-foreground px-2 py-3 text-sm">
                  No matches. Press Enter to use your text.
                </p>
              )}
              {items.map((item, index) => {
                const isHighlighted = index === highlightedIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-master-combobox-option={`${listInstanceId}-${index}`}
                    className={cn(
                      'flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none',
                      isHighlighted
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-accent'
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectItem(item)
                    }}
                  >
                    <span className="font-medium">{item.name}</span>
                    {masterType === 'hospitals' && item.address && (
                      <span
                        className={cn(
                          'line-clamp-1 text-xs',
                          isHighlighted ? 'text-white/80' : 'text-muted-foreground'
                        )}
                      >
                        {item.address}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  )
}
