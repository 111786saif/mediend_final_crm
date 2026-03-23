'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useBadgeCounts } from '@/hooks/use-badge-counts'
import { ProtectedRoute } from '@/components/protected-route'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { Button } from '@/components/ui/button'
import { CalendarIcon, CheckSquare, LayoutDashboard, ListTodo, MessageSquare, Search, Sparkles, Home, UserCheck, UserCircle, Wallet } from 'lucide-react'
import { useAI } from '@/components/ai/ai-provider'
import { CommandPalette } from '@/components/command-palette'
import { PageTransition } from '@/components/page-transition'
import { useState, useMemo, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/rbac'
import type { SessionUser } from '@/lib/auth'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { WorkLogEnforcer } from '@/components/calendar/work-log-enforcer'

function AIHeaderButton() {
  const { user } = useAuth()
  const ai = useAI()
  if (!ai || user?.role !== 'ADMIN') return null
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={ai.openAI}
      className="md:hidden"
      aria-label="Open mediendAI"
    >
      <Sparkles className="h-5 w-5 text-purple-500" />
    </Button>
  )
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : count
  return (
    <span className="absolute -top-2 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold leading-none px-[2.5px] ring-[1.5px] ring-background">
      {label}
    </span>
  )
}

interface BottomNavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  matchPrefixes?: string[]
}

function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border shadow-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.matchPrefixes?.some((p) => pathname?.startsWith(p)) ?? false)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 gap-1 py-1.5 px-2 rounded-xl transition-all duration-200 active:scale-95',
                isActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {/* Active pill background */}
              {isActive && (
                <span className="absolute inset-0 rounded-xl bg-primary" />
              )}
              <span className="relative inline-flex">
                <item.icon className="h-5 w-5" />
                {item.badge != null && item.badge > 0 && (
                  <NavBadge count={item.badge} />
                )}
              </span>
              <span className="relative text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function AuthenticatedWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const { data: badgeCounts } = useBadgeCounts()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const { subscribe, isSupported } = usePushSubscription()
  const pushTriedRef = useRef(false)

  useEffect(() => {
    if (!user || !isSupported || pushTriedRef.current) return
    pushTriedRef.current = true
    subscribe()
  }, [user, isSupported, subscribe])

  // Dynamic bottom nav (role-based like sidebar). Home is always the center item (index 2).
  // Must be called unconditionally (before any early return) to satisfy rules of hooks.
  const bottomNavItems = useMemo((): BottomNavItem[] => {
    const u = user as SessionUser | null
    if (!u) return []

    const tasksBadge =
      u.role === 'MD' || u.role === 'ADMIN'
        ? (badgeCounts?.pendingTaskReviews ?? 0) + (badgeCounts?.pendingDueDateApprovals ?? 0)
        : (badgeCounts?.myPendingTasks ?? 0)
    const approvalsBadge =
      (badgeCounts?.pendingFinanceApprovals ?? 0) +
      (u.role === 'MD' || u.role === 'ADMIN' ? (badgeCounts?.pendingMDApprovals ?? 0) : 0) +
      (u.role === 'FINANCE_HEAD' ? (badgeCounts?.pendingFinanceTeamApprovals ?? 0) : 0)
    const messagesBadge =
      u.role === 'MD' || u.role === 'ADMIN'
        ? (badgeCounts?.unreadMessages ?? 0)
        : (badgeCounts?.unreadChatMessages ?? 0) || (badgeCounts?.unreadMessages ?? 0)

    const hasApprovals = u.role === 'MD' || u.role === 'ADMIN' || hasPermission(u, 'finance:approve')
    const hasDashboard = ['SALES_HEAD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'ADMIN'].includes(u.role)
    const hasCoreHr = ['USER', 'BD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'ADMIN'].includes(u.role)
    const hasPipeline = u.role === 'BD' || u.role === 'TEAM_LEAD'
    const hasMessages =
      u.role === 'MD' ||
      u.role === 'ADMIN' ||
      ['BD', 'INSURANCE', 'INSURANCE_HEAD', 'PL_HEAD', 'PL_ENTRY', 'PL_VIEWER', 'ACCOUNTS', 'ADMIN'].includes(u.role)
    const hasSupport = ['USER', 'BD', 'SALES_HEAD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'ADMIN'].includes(u.role)
    const hasFinancial = ['USER', 'BD', 'SALES_HEAD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'ADMIN'].includes(u.role)

    const leftCandidates: (BottomNavItem & { show: boolean })[] = [
      {
        href: '/md/tasks',
        label: 'Tasks',
        icon: ListTodo,
        badge: tasksBadge,
        matchPrefixes: ['/md/tasks'],
        show: true,
      },
      {
        href: '/md/approvals',
        label: 'Approvals',
        icon: CheckSquare,
        badge: approvalsBadge,
        matchPrefixes: ['/md/approvals'],
        show: hasApprovals,
      },
      {
        href:
          u.role === 'SALES_HEAD'
            ? '/sales/dashboard'
            : u.role === 'TEAM_LEAD'
              ? '/team-lead/dashboard'
              : '/bd/pipeline',
        label: u.role === 'SALES_HEAD' || u.role === 'TEAM_LEAD' ? 'Dashboard' : 'Pipeline',
        icon: LayoutDashboard,
        matchPrefixes: ['/sales/dashboard', '/bd/pipeline', '/team-lead/dashboard'],
        show: hasDashboard || hasPipeline,
      },
      {
        href: '/employee/dashboard/core-hr',
        label: 'Core HR',
        icon: UserCircle,
        matchPrefixes: ['/employee/dashboard/core-hr'],
        show: hasCoreHr && !hasApprovals && !hasDashboard && !hasPipeline,
      },
    ]

    const rightCandidates: (BottomNavItem & { show: boolean })[] = [
      {
        href: u.role === 'MD' || u.role === 'ADMIN' ? '/md/anonymous-messages' : '/chat',
        label: 'Messages',
        icon: MessageSquare,
        badge: hasMessages ? messagesBadge : undefined,
        matchPrefixes: ['/md/anonymous-messages', '/chat'],
        show: hasMessages,
      },
      {
        href: '/employee/dashboard/support-services',
        label: 'Support',
        icon: MessageSquare,
        matchPrefixes: ['/employee/dashboard/support-services'],
        show: hasSupport && !hasMessages,
      },
      {
        href: '/employee/dashboard/financial',
        label: 'Financial',
        icon: Wallet,
        matchPrefixes: ['/employee/dashboard/financial'],
        show: hasFinancial && !hasMessages && !hasSupport,
      },
    ]

    const left = leftCandidates.filter((c) => c.show).slice(0, 2)
    const right = rightCandidates.filter((c) => c.show).slice(0, 1)

    const homeItem: BottomNavItem = {
      href: '/home',
      label: 'Home',
      icon: Home,
      badge: badgeCounts?.pendingNotices ?? 0,
      matchPrefixes: ['/home'],
    }

    const profileOrMdApprovalsItem: BottomNavItem =
      u.role === 'MD'
        ? {
            href: '/md/md-approvals',
            label: 'MD Approvals',
            icon: UserCheck,
            matchPrefixes: ['/md/md-approvals'],
          }
        : {
            href: '/profile',
            label: 'Profile',
            icon: UserCircle,
            matchPrefixes: ['/profile'],
          }

    const leftItems = left.map(({ show, ...item }) => item)
    const rightItems = [...right.map(({ show, ...item }) => item), profileOrMdApprovalsItem]
    return [...leftItems, homeItem, ...rightItems]
  }, [user, badgeCounts])

  const isLoginPage = pathname === '/login'
  const isPayslipPage = pathname?.includes('/payroll/') && pathname?.includes('/slip')
  const isDocumentViewPage = pathname?.includes('/documents/') && pathname?.includes('/view')
  const isPrintPage = pathname?.includes('/print/')
  const isAcknowledgePage = pathname?.startsWith('/documents/acknowledge')

  const shouldShowSidebar =
    !isLoading && user && !isLoginPage && !isPayslipPage && !isDocumentViewPage && !isPrintPage && !isAcknowledgePage

  if (isLoginPage || isPayslipPage || isDocumentViewPage || isPrintPage || isAcknowledgePage) {
    return <>{children}</>
  }

  return (
    <ProtectedRoute>
      <WorkLogEnforcer />
      {shouldShowSidebar ? (
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />
          <SidebarInset>
            {/* Desktop top bar */}
            <header className="hidden md:flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="flex flex-1 items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCommandPaletteOpen(true)}
                  title="Search pages (Ctrl+K)"
                >
                  <Search className="h-5 w-5" />
                </Button>
                <AIHeaderButton />
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/calendar" title="Calendar">
                    <CalendarIcon className="h-5 w-5" />
                  </Link>
                </Button>
                <NotificationBell />
              </div>
            </header>

            {/* Floating sidebar trigger - mobile only */}
            <div
              className="fixed left-4 z-40 md:hidden"
              style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
            >
              <SidebarTrigger
                className="h-11 w-11 rounded-full border border-border bg-card shadow-md hover:bg-muted/80"
                aria-label="Open menu"
              />
            </div>

            <main
              className="flex flex-1 flex-col gap-4 p-4 pt-14 md:p-6 md:pt-6 bg-background pb-24 md:pb-6"
            >
              <PageTransition>
                {children}
              </PageTransition>
            </main>

            {/* Unified bottom nav - all roles */}
            <BottomNav items={bottomNavItems} />
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <>{children}</>
      )}
      {shouldShowSidebar && (
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      )}
    </ProtectedRoute>
  )
}
