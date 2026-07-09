'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { getFilteredNavItemsWithUrls } from '@/lib/sidebar-nav'
import { apiGet } from '@/lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface CommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps = {} as CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [leads, setLeads] = useState<any[]>([])
  const [isSearchingLeads, setIsSearchingLeads] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen: (value: boolean) => void = onOpenChange || ((value: boolean) => setInternalOpen(value))

  // Get accessible navigation items
  const navItems = useMemo(() => {
    return getFilteredNavItemsWithUrls(user ?? null)
  }, [user])

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return navItems.slice(0, 30) // Limit to 30 items when no search
    }

    const query = searchQuery.toLowerCase()
    return navItems
      .filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(query)
        const urlMatch = item.url.toLowerCase().includes(query)
        return titleMatch || urlMatch
      })
      .slice(0, 30) // Limit results
  }, [navItems, searchQuery])

  // Debounced search for patients and cases
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLeads([])
      return
    }

    const handler = setTimeout(async () => {
      setIsSearchingLeads(true)
      try {
        const data = await apiGet<any[]>(`/api/leads?search=${encodeURIComponent(searchQuery)}&limit=10`)
        setLeads(data || [])
      } catch (err) {
        console.error('Failed to search leads', err)
      } finally {
        setIsSearchingLeads(false)
      }
    }, 300)

    return () => clearTimeout(handler)
  }, [searchQuery])

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems, leads.length])

  // Keyboard shortcut handler (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        setOpen(!open)
      }
      if (event.key === 'Escape' && open) {
        setOpen(false)
        setSearchQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      setSearchQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Keyboard navigation within results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalLength = filteredItems.length + leads.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, totalLength - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex < filteredItems.length) {
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex].url)
        }
      } else {
        const leadIdx = selectedIndex - filteredItems.length
        if (leads[leadIdx]) {
          handleSelect(`/patient/${leads[leadIdx].id}`)
        }
      }
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector('[data-selected="true"]') as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  const handleSelect = (url: string) => {
    setOpen(false)
    setSearchQuery('')
    setSelectedIndex(0)
    setTimeout(() => {
      router.push(url)
    }, 50)
  }



  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="sr-only">Search Pages, Patients & Cases</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search pages, patients or cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-9 h-12 text-base"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                <Command className="h-3 w-3" />
                K
              </kbd>
            </div>
          </div>
        </div>
        <div className="border-t px-2 py-2 max-h-[400px] overflow-y-auto" ref={resultsRef}>
          {isSearchingLeads && (
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground animate-pulse">
              Searching patients & cases...
            </div>
          )}

          {filteredItems.length === 0 && leads.length === 0 && !isSearchingLeads ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Pages
                  </div>
                  {filteredItems.map((item, index) => {
                    const Icon = item.icon
                    const isSelected = index === selectedIndex
                    return (
                      <Link
                        key={`${item.url}-${index}`}
                        href={item.url}
                        onClick={(e) => {
                          e.preventDefault()
                          handleSelect(item.url)
                        }}
                        data-selected={isSelected ? 'true' : 'false'}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors text-sm',
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.url}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {leads.length > 0 && (
                <div className="space-y-1 border-t pt-3">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Patients & Cases
                  </div>
                  {leads.map((lead, index) => {
                    const leadIndex = filteredItems.length + index
                    const isSelected = leadIndex === selectedIndex

                    // Determine active pages/forms/files
                    const links = []
                    links.push({ label: 'Profile', url: `/patient/${lead.id}` })
                    if (lead.kypSubmission) {
                      links.push({ label: 'KYP', url: `/patient/${lead.id}/kyp` })
                    }
                    if (lead.insuranceInitiateForm) {
                      links.push({ label: 'Pre-Auth', url: `/patient/${lead.id}/pre-auth` })
                    }
                    if (lead.dischargeSheet) {
                      const url = lead.flowType === 'CASH'
                        ? `/patient/${lead.id}/discharge-cash`
                        : `/patient/${lead.id}/discharge`
                      links.push({ label: 'Discharge', url })
                    }

                    return (
                      <div
                        key={lead.id}
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => handleSelect(`/patient/${lead.id}`)}
                        className={cn(
                          'w-full px-3 py-2.5 rounded-md text-left transition-colors text-sm border border-transparent cursor-pointer',
                          isSelected
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/patient/${lead.id}`}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleSelect(`/patient/${lead.id}`)
                              }}
                              className="font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                            >
                              {lead.patientName}
                            </Link>
                            <span className="ml-2 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">
                              {lead.leadRef}
                            </span>
                            {lead.phoneNumber && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({lead.phoneNumber})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Clickable document paths/links */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="text-[10px] text-muted-foreground mr-1 uppercase font-semibold">
                            Forms:
                          </span>
                          {links.map((link, linkIdx) => (
                            <span key={link.label} className="flex items-center">
                              {linkIdx > 0 && <span className="mx-1 text-slate-300 dark:text-slate-700">/</span>}
                              <Link
                                href={link.url}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleSelect(link.url)
                                }}
                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              >
                                {link.label}
                              </Link>
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        {filteredItems.length + leads.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>
                {filteredItems.length + leads.length} results
              </span>
              <span className="flex items-center gap-2">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↑↓
                </kbd>
                <span>Navigate</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  Enter
                </kbd>
                <span>Select</span>
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
