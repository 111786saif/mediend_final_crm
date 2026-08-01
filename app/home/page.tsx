'use client'

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useBadgeCounts } from '@/hooks/use-badge-counts'
import { useNotifications } from '@/hooks/use-notifications'
import { useUserBanner, useUpdateUserBanner } from '@/hooks/use-settings'
import { useFileUpload } from '@/hooks/use-file-upload'
import { getFilteredNavItemsWithUrls } from '@/lib/sidebar-nav'
import { StatCard } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import {
  Camera,
  Bell,
  ExternalLink,
  Clock,
  Quote,
  Home,
  BarChart3,
  Target,
  Users,
  FileText,
  MessageSquare,
  Calendar,
  CreditCard,
  Shield,
  DollarSign,
  Wallet,
  ClipboardList,
  UserCircle,
  TrendingUp,
  Briefcase,
  Heart,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { THOUGHTS_OF_THE_DAY } from '@/data/thoughts-of-the-day'
import { format, formatDistanceToNow } from 'date-fns'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { useWorkLogCheck } from '@/hooks/use-work-logs'
import { AddWorkLogButton } from '@/components/calendar/add-work-log-button'
import { NoticeBlockerModal } from '@/components/notices/notice-blocker-modal'
import { ViewNoticesSheet } from '@/components/notices/view-notices-sheet'
import { CreateNoticeModal } from '@/components/notices/create-notice-modal'
import { NewHireWelcomePopup } from '@/components/new-hire-welcome-popup'
import { Megaphone } from 'lucide-react'
import { FnFReminderCard } from '@/components/hr/fnf-reminder-card'
import { BirthdayCelebrationCard } from '@/components/birthday-celebration-card'
import { NewJoinerCelebrationCard } from '@/components/new-joiner-celebration-card'
import { BirthdayPopup } from '@/components/birthday-popup'
import { RankUpPopup } from '@/components/notifications/rank-up-popup'
import { TeamTargetWidget } from '@/components/targets/team-target-widget'
import { TLTeamAchievements } from '@/components/targets/tl-team-achievements'   
import { useMyTargetProgress, TargetRingInline, TargetRingInlineEmpty } from '../../app/bd/dashboard/BDDashboard'
import { TargetTrendCard } from '@/components/targets/target-trend-card'
import { LeadsTrendCard } from '@/components/targets/leads-trend-card'
import { MonthlySummaryCard } from '@/components/targets/monthly-summary-card'


// ─── Greeting ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Nav item → accent color mapping ─────────────────────────────────────────

const ICON_COLOR_MAP: Record<string, string> = {
  Tasks: 'bg-blue-100 text-blue-600',
  Dashboard: 'bg-indigo-100 text-indigo-600',
  'Sales Dashboard': 'bg-emerald-100 text-emerald-600',
  'Finance Dashboard': 'bg-amber-100 text-amber-600',
  'HR Dashboard': 'bg-purple-100 text-purple-600',
  Pipeline: 'bg-orange-100 text-orange-600',
  KYP: 'bg-cyan-100 text-cyan-600',
  Targets: 'bg-rose-100 text-rose-600',
  Teams: 'bg-violet-100 text-violet-600',
  Insurance: 'bg-sky-100 text-sky-600',
  'Cash Cases': 'bg-teal-100 text-teal-600',
  Chat: 'bg-pink-100 text-pink-600',
  Incentive: 'bg-amber-100 text-amber-600',
  'P/L': 'bg-lime-100 text-lime-600',
  Outstanding: 'bg-red-100 text-red-600',
  Users: 'bg-slate-100 text-slate-600',
  Reports: 'bg-yellow-100 text-yellow-600',
  'My Core HR': 'bg-purple-100 text-purple-600',
  'My Financial': 'bg-green-100 text-green-600',
  'My Support & Services': 'bg-blue-100 text-blue-600',
  'My Team': 'bg-indigo-100 text-indigo-600',
  'HR Attendance': 'bg-orange-100 text-orange-600',
  'HR Leaves': 'bg-cyan-100 text-cyan-600',
  'HR Employees': 'bg-violet-100 text-violet-600',
  'Fin Payroll': 'bg-emerald-100 text-emerald-600',
  Departments: 'bg-amber-100 text-amber-600',
  'MD Messages': 'bg-pink-100 text-pink-600',
  Appointments: 'bg-sky-100 text-sky-600',
  Surgeries: 'bg-red-100 text-red-600',
  'Dept Targets': 'bg-rose-100 text-rose-600',
  Finance: 'bg-yellow-100 text-yellow-600',
  'Finance Ledger': 'bg-lime-100 text-lime-600',
  Calendar: 'bg-teal-100 text-teal-600',
  Meets: 'bg-indigo-100 text-indigo-600',
  Recruitment: 'bg-fuchsia-100 text-fuchsia-600',
}

function getNavIconColor(title: string) {
  return ICON_COLOR_MAP[title] ?? 'bg-primary/10 text-primary'
}

// ─── Banner section ────────────────────────────────────────────────────────────

function BannerSection({
  greeting,
  firstName,
  role,
  targetSlot,
}: {
  greeting: string
  firstName: string
  role?: string
  targetSlot?: React.ReactNode
}) {
  const today = format(new Date(), 'EEEE, d MMMM')

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a2540] via-[#0d3b5c] to-[#0f5c56] p-6 md:p-8 shadow-sm">
      {/* Subtle decorative circles — texture without a photo */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-6 top-10 h-32 w-32 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute right-24 -bottom-10 h-40 w-40 rounded-full bg-white/5" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-teal-500 text-[#0a2540] text-lg md:text-xl font-bold shadow-sm">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-wide">{today}</p>
            <h1 className="text-white text-xl md:text-2xl font-bold tracking-tight mt-0.5">
              {greeting}, {firstName}
            </h1>
            {role && (
              <p className="text-white/70 text-sm font-medium mt-0.5">{role.replace(/_/g, ' ')}</p>
            )}
          </div>
        </div>

        {targetSlot && (
          <>
            <div className="hidden sm:block h-14 w-px bg-white/15" />
            <div className="shrink-0">{targetSlot}</div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Thought of the Day ───────────────────────────────────────────────────────

// const DEFAULT_BANNER = '/Serene Night Scene with Shooting Star.png'

function getThoughtOfTheDay(): string {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const diff = Date.now() - start.getTime()
  const oneDay = 86400000
  const dayOfYear = Math.floor(diff / oneDay)
  const index = dayOfYear % THOUGHTS_OF_THE_DAY.length
  const item = THOUGHTS_OF_THE_DAY[index]
  return `${item.thought} — ${item.author}`
}

function ThoughtOfTheDay({ thought }: { thought: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-3 items-start shadow-sm">
      <Quote className="h-5 w-5 text-[#1EC5B7] shrink-0 mt-0.5" />
      <p className="text-sm text-muted-foreground italic leading-relaxed flex-1 min-w-0">{thought}</p>
    </div>
  )
}

// ─── Notifications panel ───────────────────────────────────────────────────────

function TodaysMeetsSection() {
  type HomeMeet = {
    id: string
    title: string
    scheduledAt: string
    type: 'VIRTUAL' | 'OFFLINE'
    meetLink: string | null
    module: string
  }

  const { data: meets = [], isLoading } = useQuery<HomeMeet[]>({
    queryKey: ['meets-today-home'],
    queryFn: () => apiGet<HomeMeet[]>('/api/meets?today=true'),
  })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 animate-pulse h-20" />
    )
  }

  if (meets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 dark:from-indigo-950/20 p-3 text-center text-xs text-muted-foreground">
        No meetings scheduled for today.{' '}
        <Link href="/meets" className="text-indigo-600 font-medium underline-offset-2 hover:underline">
          View all meets
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border-2 border-indigo-200/70 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/90 via-white to-fuchsia-50/40 dark:from-indigo-950/30 dark:via-card dark:to-fuchsia-950/20 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100/80 dark:border-indigo-900/50">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold text-sm">Today&apos;s meets</span>
        </div>
        <Link
          href="/meets"
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          All meets
        </Link>
      </div>
      <ul className="divide-y divide-indigo-100/60 dark:divide-indigo-900/40">
        {meets.map((m) => (
          <li key={m.id} className="px-3 py-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{m.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(m.scheduledAt), 'h:mm a')}
                {m.module === 'INTERVIEW' && (
                  <span className="ml-1 text-violet-600">· Interview</span>
                )}
                {m.module === 'MD_APPOINTMENT' && (
                  <span className="ml-1 text-amber-600">· MD</span>
                )}
              </p>
            </div>
            {m.meetLink && (
              <Button size="sm" className="h-8 rounded-lg shrink-0 text-xs" asChild>
                <a href={m.meetLink} target="_blank" rel="noreferrer">
                  Join
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecentNotifications() {
  const { data: notifications = [] } = useNotifications(true)
  const recent = notifications.slice(0, 5)

  if (recent.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Recent Notifications</span>
        </div>
        <span className="text-xs text-muted-foreground">{recent.length} unread</span>
      </div>
      <ul className="divide-y divide-border">
        {recent.map((n) => (
          <li key={n.id}>
            {n.link ? (
              <Link
                href={n.link}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>
                </span>
                <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                  <ExternalLink className="h-3 w-3 ml-1" />
                </div>
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.message}</p>
                </span>
                <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── My Target Widget (for department heads) ──────────────────────────────────

const HEAD_ROLES = ['SALES_HEAD', 'HR_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD'] as const

function MyTargetWidget() {
  const { user } = useAuth()
  const isHead = user && HEAD_ROLES.includes(user.role as (typeof HEAD_ROLES)[number])
  const { data } = useQuery({
    queryKey: ['head-target-achievement', user?.id],
    queryFn: () =>
      apiGet<{
        metric: string
        currentMonth: { month: string; targetValue: number; actual: number; percentage: number }
      }>(`/api/md/head-targets/achievement?headUserId=${user?.id}`),
    enabled: !!user?.id && !!isHead,
  })

  if (!isHead || !data?.currentMonth || data.currentMonth.targetValue <= 0) return null

  const { actual, targetValue, percentage } = data.currentMonth
  const metricLabel =
    data.metric === 'IPD_DONE'
      ? 'IPD Done'
      : data.metric === 'HEAD_COUNT'
        ? 'New Hires'
        : data.metric === 'LEADS_GENERATED'
          ? 'Leads'
          : 'Revenue'

  const displayValue =
    data.metric === 'REVENUE'
      ? `₹${(actual / 100000).toFixed(1)}L / ₹${(targetValue / 100000).toFixed(1)}L`
      : `${actual} / ${targetValue}`

  return (
    <StatCard
      label={`My target (${metricLabel})`}
      value={`${displayValue} · ${percentage}%`}
      accent="emerald"
      valueAccent
      href="/md/targets"
    />
  )
}

// ─── KPI section ──────────────────────────────────────────────────────────────

function KPISection() {
  const { user } = useAuth()
  const { data: badgeCounts } = useBadgeCounts()
  const isMdOrAdmin = user?.role === 'MD' || user?.role === 'ADMIN'

  if (isMdOrAdmin) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
        <StatCard
          label="Pending task reviews"
          value={badgeCounts?.pendingTaskReviews ?? '—'}
          accent="amber"
          valueAccent
          href="/md/tasks#approval"
        />
        <StatCard
          label="My overdue tasks"
          value={badgeCounts?.myOverdueTasks ?? '—'}
          accent="red"
          valueAccent
          href="/md/tasks"
        />
        <StatCard
          label="Finance approvals"
          value={badgeCounts?.pendingFinanceApprovals ?? '—'}
          accent="purple"
          valueAccent
          href="/finance/ledger"
        />
        <StatCard
          label="Pending appointments"
          value={badgeCounts?.pendingAppointments ?? '—'}
          accent="blue"
          href="/md/appointments"
        />
        <StatCard
          label="Unread messages"
          value={badgeCounts?.unreadMessages ?? '—'}
          accent="teal"
          href="/md/anonymous-messages"
        />
        <StatCard
          label="Due date approvals"
          value={badgeCounts?.pendingDueDateApprovals ?? '—'}
          accent="orange"
          href="/md/tasks#approval"
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <MyTargetWidget />
      <StatCard
        label="My pending tasks"
        value={badgeCounts?.myPendingTasks ?? '—'}
        accent="amber"
        valueAccent
        href="/md/tasks"
      />
      <StatCard
        label="Overdue tasks"
        value={badgeCounts?.myOverdueTasks ?? '—'}
        accent="red"
        valueAccent
        href="/md/tasks"
      />
      <StatCard
        label="Due date approvals"
        value={badgeCounts?.pendingDueDateApprovals ?? '—'}
        accent="purple"
        href="/md/tasks#approval"
      />
    </div>
  )
}

// ─── Navigation cards ─────────────────────────────────────────────────────────

function NavCard({
  title,
  url,
  icon: Icon,
  badge,
}: {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}) {
  const colorClass = getNavIconColor(title)

  return (
    <Link
      href={url}
      className="bg-card border border-border rounded-xl p-4 flex flex-col items-start gap-2.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95 group shadow-sm"
    >
      <div className={cn('rounded-xl p-2.5 flex items-center justify-center relative', colorClass)}>
        <Icon className="h-5 w-5" />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-[3px] ring-[1.5px] ring-background">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
        {title}
      </span>
    </Link>
  )
}

function NavCards() {
  const { user } = useAuth()
  const { data: badgeCounts } = useBadgeCounts()
  const { data: unreadNotifications = [] } = useNotifications(true)
  const navItems = useMemo(() => getFilteredNavItemsWithUrls(user ?? null), [user])

  const meetUnreadCount = useMemo(
    () =>
      unreadNotifications.filter(
        (n) => n.type === 'MEET_SCHEDULED' || n.type === 'MEET_REMINDER'
      ).length,
    [unreadNotifications]
  )

  const getBadge = (title: string) => {
    if (title === 'Meets') return meetUnreadCount > 0 ? meetUnreadCount : undefined
    if (!badgeCounts) return undefined
    if (title === 'Tasks') return badgeCounts.taskOverviewCount ?? undefined
    if (title === 'MD Messages') return badgeCounts.unreadMessages
    if (title === 'Appointments') return badgeCounts.pendingAppointments
    if (title === 'Finance' || title === 'Finance Ledger') return badgeCounts.pendingFinanceApprovals
    return undefined
  }

  if (navItems.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Quick Navigation
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {navItems.map((item) => (
          <NavCard
            key={`${item.title}::${item.url}`}
            title={item.title}
            url={item.url}
            icon={item.icon}
            badge={getBadge(item.title)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Push reminder banner ───────────────────────────────────────────────────────

function PushReminderBanner() {
  const { subscribe, permission, isSupported } = usePushSubscription()
  const [loading, setLoading] = useState(false)

  if (!isSupported || permission === 'granted') return null

  const handleEnable = async () => {
    setLoading(true)
    await subscribe()
    setLoading(false)
  }

  return (
    <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl p-3 flex items-center justify-between gap-3">
      <p className="text-sm text-teal-800 dark:text-teal-200">
        Enable push reminders for work log deadlines
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-teal-300 text-teal-700 hover:bg-teal-100 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-900/50"
        onClick={handleEnable}
        disabled={loading || permission === 'denied'}
      >
        {loading ? 'Enabling…' : 'Enable'}
      </Button>
    </div>
  )
}

// ─── Notice actions (View + Create) ────────────────────────────────────────────

function NoticeActions() {
  const [viewOpen, setViewOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const { data: canCreate } = useQuery<{ allowed: boolean }>({
    queryKey: ['permission-create-notice'],
    queryFn: () => apiGet<{ allowed: boolean }>('/api/permissions/check?feature=create_notice'),
  })

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewOpen(true)}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          View Notices
        </Button>
        {canCreate?.allowed && (
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-2"
          >
            <Megaphone className="h-4 w-4" />
            Create Notice
          </Button>
        )}
      </div>
      <ViewNoticesSheet open={viewOpen} onOpenChange={setViewOpen} />
      <CreateNoticeModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const showFnFCard = user?.role === 'HR_HEAD'
const { data: workLogCheck } = useWorkLogCheck({
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
  })
  const subjectToWorkLogs = workLogCheck?.subjectToWorkLogs ?? false

  const greeting = getGreeting()
  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const thought = useMemo(() => getThoughtOfTheDay(), [])
  const { isTargetRole, monthly: monthlyTarget } = useMyTargetProgress()

  useEffect(() => {
    if (user?.role === 'MD') {
      router.replace('/md/home')
    }
  }, [user, router])

  if (user?.role === 'MD') {
    return null
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full">
      <BirthdayPopup />
      <RankUpPopup />
      <NoticeBlockerModal />
      <NewHireWelcomePopup />
      {/* Banner + Greeting */}
       <BannerSection
        greeting={greeting}
        firstName={firstName}
        role={user?.role}
        targetSlot={
          isTargetRole
            ? (monthlyTarget ? <TargetRingInline t={monthlyTarget} /> : <TargetRingInlineEmpty />)
            : undefined
        }
      />

      {/* Thought of the Day */}
      <ThoughtOfTheDay thought={thought} />

      {/* Birthday celebration */}
      <BirthdayCelebrationCard />

      {/* New joiner announcement */}
      <NewJoinerCelebrationCard />

      {/* Add work log - MD team & watchlist users (those enforced to log) */}
      {subjectToWorkLogs && (
        <div className="flex justify-end">
          <AddWorkLogButton visible={true} />
        </div>
      )}

      {/* Push reminder banner */}
      <PushReminderBanner />

       {/* KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          At a Glance
        </h2>
        <KPISection />
      </div>

      {/* FnF reminder for HR */}
      {showFnFCard && <FnFReminderCard />}

      {/* Notice actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Notices
        </h2>
        <NoticeActions />
      </div>


      {/* Monthly rewards summary — Sales/BD hierarchy only */}
      <MonthlySummaryCard />

      {/* Target progress widget (compact — TL and Sales Head team overview) */}
      <TeamTargetWidget />

      {/* TL only: each team member's achievement vs their individual target */}
      <TLTeamAchievements />

      {/* Target trend — monthly/weekly chart for all roles with targets (BD, TL, Heads) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TargetTrendCard />
        <LeadsTrendCard />
      </div>


     

      {/* Today's meets */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today
        </h2>
        <TodaysMeetsSection />
      </div>

      {/* Recent Notifications */}
      <RecentNotifications />

      {/* Navigation cards */}
      <NavCards />
    </div>
  )
}