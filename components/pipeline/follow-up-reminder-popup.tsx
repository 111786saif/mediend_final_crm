'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Bell, PhoneCall, X } from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'follow-up-reminders-dismissed'

type UpcomingFollowUp = {
  id: number
  leadRef: string
  patientName: string
  followUpDate: string
}

function loadDismissed() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return [] as string[]
  }
}

function reminderKey(lead: UpcomingFollowUp) {
  return `${lead.id}:${lead.followUpDate}`
}

/** Shows an in-app reminder five minutes before a signed-in user's follow-up. */
export function FollowUpReminderPopup() {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setDismissed(loadDismissed())
    setHydrated(true)
  }, [])

  const { data: followUps = [] } = useQuery<UpcomingFollowUp[]>({
    queryKey: ['follow-up-reminders'],
    queryFn: () => apiGet<UpcomingFollowUp[]>('/api/leads/follow-up-reminders'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const active = useMemo(() => {
    if (!hydrated) return null
    return followUps.find((lead) => !dismissed.includes(reminderKey(lead))) ?? null
  }, [dismissed, followUps, hydrated])

  if (!active) return null

  const dismiss = () => {
    const next = [...dismissed, reminderKey(active)]
    setDismissed(next)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <div
      className={cn(
        'fixed left-2 right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[46]',
        'animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-none',
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-0.5 shadow-xl">
        <div className="rounded-[14px] bg-card/95 px-3 py-2.5 backdrop-blur-sm dark:bg-card/95 md:px-4 md:py-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 dark:bg-amber-950">
              <Bell className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Follow-up due soon</p>
              <p className="text-sm font-bold leading-snug">Call {active.patientName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lead {active.leadRef} · Follow-up at {format(new Date(active.followUpDate), 'h:mm a')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" className="h-8 rounded-xl text-xs" asChild>
                  <Link href={`/patient/${active.id}`} onClick={dismiss}>
                    <PhoneCall className="mr-1 h-3.5 w-3.5" />
                    Open lead to call
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-xl text-xs" onClick={dismiss}>
                  Dismiss
                </Button>
              </div>
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-full" onClick={dismiss} aria-label="Dismiss follow-up reminder">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
