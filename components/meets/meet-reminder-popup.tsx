'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { X, Video, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'meet-reminder-dismissed'

function loadDismissed(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveDismissed(ids: string[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

type UpcomingMeet = {
  id: string
  title: string
  scheduledAt: string
  meetLink: string | null
  type: 'VIRTUAL' | 'OFFLINE'
}

export function MeetReminderPopup() {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setDismissed(loadDismissed())
    setHydrated(true)
  }, [])

  const { data: meets = [] } = useQuery<UpcomingMeet[]>({
    queryKey: ['meets-upcoming-reminder'],
    queryFn: () => apiGet<UpcomingMeet[]>('/api/meets/upcoming?minutes=10'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const active = useMemo(() => {
    if (!hydrated) return null
    return meets.find((m) => !dismissed.includes(m.id)) ?? null
  }, [meets, dismissed, hydrated])

  if (!active) return null

  const dismiss = () => {
    const next = [...dismissed, active.id]
    setDismissed(next)
    saveDismissed(next)
  }

  return (
    <div
      className={cn(
        'fixed left-2 right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[45]',
        'animate-in slide-in-from-top-2 fade-in duration-300',
        'pointer-events-none'
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-indigo-400/60',
          'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-0.5 shadow-xl'
        )}
      >
        <div className="rounded-[14px] bg-card/95 dark:bg-card/95 backdrop-blur-sm px-3 py-2.5 md:px-4 md:py-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 p-1.5">
              <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                Starting soon
              </p>
              <p className="text-sm font-bold leading-snug line-clamp-2">{active.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(active.scheduledAt), 'h:mm a')}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {active.meetLink && (
                  <Button
                    size="sm"
                    className="rounded-xl h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                    asChild
                  >
                    <a href={active.meetLink} target="_blank" rel="noreferrer">
                      <Video className="h-3.5 w-3.5 mr-1" />
                      Join
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl h-8 text-xs"
                  onClick={dismiss}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={dismiss}
              aria-label="Close reminder"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
