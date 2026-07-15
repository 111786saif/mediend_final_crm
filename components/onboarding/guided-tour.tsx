'use client'

import { useCallback, useMemo, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { Button } from '@/components/ui/button'
import {
  CalendarCheck,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  Target,
  UserCircle,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/generated/prisma/enums'
import type { LucideIcon } from 'lucide-react'

interface TourTarget {
  id: string
  selector: string
  title: string
  description: string
  icon: LucideIcon
  /** If set, only these roles see this card. Omit = everyone. */
  roles?: UserRole[]
}

const TOUR_TARGETS: TourTarget[] = [
  {
    id: 'home',
    selector: '[data-tour="home"]',
    title: 'Home',
    description: 'Your daily hub — notices, birthdays, and quick links live here.',
    icon: Home,
  },
  {
    id: 'profile',
    selector: '[data-tour="profile"]',
    title: 'Profile',
    description: 'Keep your personal, bank, and document details up to date.',
    icon: UserCircle,
  },
  {
    id: 'pipeline',
    selector: '[data-tour="pipeline"]',
    title: 'Pipeline',
    description: 'Manage your patient leads through stages — from new enquiry to conversion.',
    icon: ClipboardList,
    roles: ['BD', 'TEAM_LEAD', 'SALES_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    id: 'case-tracker',
    selector: '[data-tour="case-tracker"]',
    title: 'Case Tracker',
    description: 'Track surgery cases, KYP submissions, and case progress end to end.',
    icon: FileText,
    roles: ['BD', 'TEAM_LEAD', 'SALES_HEAD', 'EXECUTIVE_ASSISTANT', 'PL_HEAD'],
  },
  {
    id: 'sales-dashboard',
    selector: '[data-tour="sales-dashboard"]',
    title: 'Sales Dashboard',
    description: 'See team performance, conversions, and sales KPIs at a glance.',
    icon: LayoutDashboard,
    roles: ['SALES_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    id: 'targets',
    selector: '[data-tour="targets"]',
    title: 'Targets',
    description: 'View and track monthly sales / conversion targets for you and your team.',
    icon: Target,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    id: 'pending-surgery',
    selector: '[data-tour="pending-surgery"]',
    title: 'Pending Surgery',
    description: 'Follow patients who are ready for surgery but still need cards / follow-up.',
    icon: ClipboardList,
    roles: ['TEAM_LEAD', 'SALES_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    id: 'attendance',
    selector: '[data-tour="attendance"]',
    title: 'Attendance & Leaves',
    description: 'Track punches, apply for leave, and request normalizations.',
    icon: CalendarCheck,
  },
  {
    id: 'tasks',
    selector: '[data-tour="tasks"]',
    title: 'Tasks',
    description: 'See work assigned to you and mark progress.',
    icon: ClipboardList,
  },
  {
    id: 'payroll',
    selector: '[data-tour="payroll"]',
    title: 'Payroll & Docs',
    description: 'View payslips and HR documents once your account is active.',
    icon: Wallet,
  },
]

function visibleTargets(role?: UserRole | null): TourTarget[] {
  return TOUR_TARGETS.filter((t) => {
    if (!t.roles) return true
    if (!role) return false
    return t.roles.includes(role)
  })
}

interface GuidedTourProps {
  onComplete: () => void
  className?: string
  role?: UserRole | null
}

export function GuidedTour({ onComplete, className, role }: GuidedTourProps) {
  const startedRef = useRef(false)
  const targets = useMemo(() => visibleTargets(role), [role])

  const startTour = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: false,
      overlayOpacity: 0.55,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got it',
      steps: targets.map((t) => ({
        element: t.selector,
        popover: {
          title: t.title,
          description: t.description,
          side: 'bottom' as const,
          align: 'start' as const,
        },
      })),
      onDestroyed: () => {
        startedRef.current = false
        onComplete()
      },
    })

    d.drive()
  }, [onComplete, targets])

  const hasSales = targets.some((t) =>
    ['pipeline', 'case-tracker', 'sales-dashboard', 'targets', 'pending-surgery'].includes(t.id)
  )

  return (
    <div className={cn('space-y-6', className)}>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Quick tour of Mediend Workspace</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {hasSales
            ? 'A short walkthrough of your daily tools — including pipeline and case tracking — before HR activates your account.'
            : 'Take a short guided tour of the main areas you will use every day. You can skip ahead once you are done.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((t) => (
          <div
            key={t.id}
            data-tour={t.id}
            className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-600/15 text-sky-700 dark:text-sky-300">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{t.title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button onClick={startTour} className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700">
          Start guided tour
        </Button>
        <Button variant="outline" onClick={onComplete} className="w-full sm:w-auto">
          Skip tour
        </Button>
      </div>
    </div>
  )
}
