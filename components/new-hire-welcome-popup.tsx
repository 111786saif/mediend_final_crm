'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { X, PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useHomeBlockers } from '@/hooks/use-home-blockers'

interface WelcomePayload {
  notificationId: string
  title: string
  message: string
  newHire: {
    id: string
    name: string
    profilePicture: string | null
    designation: string | null
    department: string | null
  }
}

function runConfetti() {
  const duration = 2500
  const end = Date.now() + duration
  const colors = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899']

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

export function NewHireWelcomePopup() {
  const queryClient = useQueryClient()
  const confettiOnce = useRef(false)
  const [dismissed, setDismissed] = useState(false)
  const { showNewHireWelcome } = useHomeBlockers()

  const { data } = useQuery<WelcomePayload | null>({
    queryKey: ['new-hire-welcome'],
    queryFn: () => apiGet<WelcomePayload | null>('/api/new-hires/welcome'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const dismissMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiPost('/api/new-hires/welcome', { notificationId }),
    onSuccess: () => {
      setDismissed(true)
      queryClient.invalidateQueries({ queryKey: ['new-hire-welcome'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  useEffect(() => {
    if (!data || dismissed) return
    if (confettiOnce.current) return
    confettiOnce.current = true
    runConfetti()
  }, [data, dismissed])

  if (!showNewHireWelcome || !data || dismissed) return null

  const hire = data.newHire
  const initials = hire.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const subtitle = [hire.designation, hire.department].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-10 rounded-full"
          onClick={() => dismissMutation.mutate(data.notificationId)}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="bg-gradient-to-br from-sky-600/20 via-violet-600/15 to-emerald-600/10 px-6 pt-10 pb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow">
            <PartyPopper className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{data.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data.message}</p>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 py-6">
          <Avatar className="size-28 ring-4 ring-sky-500/25 shadow-lg">
            <AvatarImage src={hire.profilePicture || undefined} alt={hire.name} />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-lg font-semibold">{hire.name}</p>
            {subtitle ? (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="border-t px-6 py-4">
          <Button
            className="w-full bg-sky-600 hover:bg-sky-700"
            disabled={dismissMutation.isPending}
            onClick={() => dismissMutation.mutate(data.notificationId)}
          >
            {dismissMutation.isPending ? 'Closing…' : 'Welcome them!'}
          </Button>
        </div>
      </div>
    </div>
  )
}
