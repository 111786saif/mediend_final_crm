'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useBadgeCounts } from '@/hooks/use-badge-counts'
import { useNotifications } from '@/hooks/use-notifications'
import { useAuth } from '@/hooks/use-auth'
import { useSidebar } from '@/components/ui/sidebar'
import { getFilteredNavItemsWithUrls, type NavItem } from '@/lib/sidebar-nav'
import { usePermissions } from '@/hooks/use-permissions'
import { resolveNavResourceKey } from '@/lib/nav-resource-map'
import { canAccessSalesOpdMonitoring } from '@/lib/opd-monitoring-access'
import {
  getRoleSidebarLayout,
  resolveLayoutTitle,
} from '@/lib/role-sidebar-layout'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronDown,
  DollarSign,
  LogOut,
  Shield,
  Sun,
  Moon,
  Sparkles,
  TrendingUp,
  User,
  UserCircle,
  Users,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import logo from '@/public/logo-mediend.png'
import { UserRole } from '@/generated/prisma/enums'
import { useTheme } from 'next-themes'

type NavItemWithUrl = NavItem & { url: string }

function getBadgeCount(
  itemTitle: string,
  counts: {
    pendingFinanceApprovals?: number
    unreadMessages?: number
    pendingAppointments?: number
    pendingTaskReviews?: number
    pendingDueDateApprovals?: number
    myOverdueTasks?: number
    myPendingTasks?: number
    pendingLeaveApprovals?: number
    pendingTickets?: number
    unreadChatMessages?: number
    pendingHRActions?: number
    pendingNotices?: number
    pendingFinanceTeamApprovals?: number
    pendingMDApprovals?: number
    pendingMDTeamNormalizations?: number
    pendingLeaveBalanceEditRequests?: number
    hrPendingNormalizations?: number
    pendingOnboardingApprovals?: number
    taskOverviewCount?: number
  } | undefined,
  _isMdOrAdmin: boolean
): number {
  if (!counts) return 0
  if (itemTitle === 'Tasks') {
    return counts.taskOverviewCount ?? 0
  }
  if (itemTitle === 'Fin Approvals') return counts.pendingFinanceApprovals ?? 0
  if (itemTitle === 'MD Messages') return counts.unreadMessages ?? 0
  if (itemTitle === 'MD Appointments') return counts.pendingAppointments ?? 0
  if (itemTitle === 'Home') return counts.pendingNotices ?? 0
  if (itemTitle === 'Chat') return counts.unreadChatMessages ?? 0
  if (itemTitle === 'Attendance & Normalizations') {
    return counts.hrPendingNormalizations ?? 0
  }
  if (itemTitle === 'Engagement') {
    const hr = counts.pendingHRActions ?? 0
    const norms = counts.hrPendingNormalizations ?? 0
    return Math.max(0, hr - norms)
  }
  if (itemTitle === 'My Support & Services') return counts.pendingTickets ?? 0
  if (itemTitle === 'Fin Team Approvals' || itemTitle === 'Team Approvals') {
    return counts.pendingFinanceTeamApprovals ?? 0
  }
  if (itemTitle === 'MD Team Approvals') return counts.pendingMDApprovals ?? 0
  if (itemTitle === 'MD Attendance') return counts.pendingMDTeamNormalizations ?? 0
  if (itemTitle === 'MD Leave balances') return counts.pendingLeaveBalanceEditRequests ?? 0
  if (itemTitle === 'Onboarding') return counts.pendingOnboardingApprovals ?? 0
  return 0
}

function displayLabel(title: string): string {
  if (title.startsWith('MD ')) return title.replace('MD ', '')
  if (title.startsWith('Fin ')) return title.replace('Fin ', '')
  if (title.startsWith('CRM ')) return title.replace('CRM ', '')
  if (title.startsWith('Svc ')) return title.replace('Svc ', '')
  return title
}

function orderByTitles(
  items: NavItemWithUrl[],
  titles: string[]
): NavItemWithUrl[] {
  const byTitle = new Map(items.map((item) => [item.title, item]))
  const ordered: NavItemWithUrl[] = []
  for (const layoutTitle of titles) {
    const resolved = resolveLayoutTitle(layoutTitle)
    const item = byTitle.get(resolved)
    if (item) ordered.push(item)
  }
  return ordered
}

export function AppSidebar() {
  const { user, logout, isTester, setActiveRole } = useAuth()
  const pathname = usePathname()
  const { isMobile, setOpenMobile, navigatingRef } = useSidebar()
  const { data: badgeCounts } = useBadgeCounts()
  const { data: unreadNotifications = [] } = useNotifications(true)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDarkMode = !mounted || theme === 'dark'
  const meetNotificationBadge = React.useMemo(
    () =>
      unreadNotifications.filter(
        (n) => n.type === 'MEET_SCHEDULED' || n.type === 'MEET_REMINDER'
      ).length,
    [unreadNotifications]
  )
  const isMdOrAdmin = user?.role === 'MD' || user?.role === 'ADMIN'

  const closeSidebarOnMobile = React.useCallback(() => {
    if (isMobile) {
      navigatingRef.current = true
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile, navigatingRef])
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    crm: pathname?.startsWith('/crm') ?? false,
    finance: false,
    hr: false,
    myHrms: false,
    sales: false,
    insurancePl: false,
  })
  const { hasAccess, permissionsReady } = usePermissions()

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  if (!user) {
    return null
  }

  if (!permissionsReady) {
    return (
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-1 p-2">
            <div className="relative h-8 w-32 shrink-0">
              <Image
                src={logo}
                alt="Mediend"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-md text-white font-bold">Workspace Beta</p>
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-1 px-2 py-3">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={`main-${i}`}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md">
                      <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-foreground/15" />
                      <Skeleton
                        className={`h-4 bg-sidebar-foreground/15 ${i % 3 === 0 ? 'w-24' : i % 3 === 1 ? 'w-32' : 'w-28'
                          }`}
                      />
                    </div>
                  </SidebarMenuItem>
                ))}
                <div className="mt-4 mb-2 flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-foreground/15" />
                    <Skeleton className="h-4 w-16 bg-sidebar-foreground/15" />
                  </div>
                  <Skeleton className="h-3 w-3 bg-sidebar-foreground/15" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={`sub-${i}`}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md">
                      <Skeleton className="h-4 w-4 shrink-0 bg-sidebar-foreground/15" />
                      <Skeleton
                        className={`h-4 bg-sidebar-foreground/15 ${i % 2 === 0 ? 'w-20' : 'w-24'
                          }`}
                      />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    )
  }

  const role = user.role
  const layout = getRoleSidebarLayout(role)
  const itemsWithUrls = getFilteredNavItemsWithUrls(user)

  const filterByPermission = (item: NavItemWithUrl) => {
    const resourceKey = resolveNavResourceKey(item.title, role)
    if (!resourceKey) return false
    if (!permissionsReady) return true

    if (hasAccess(resourceKey, 'READ')) return true

    // Pipeline / Targets may be granted under alternate role-specific keys
    if (item.title === 'Pipeline') {
      return (
        hasAccess('sales.sales_pipeline', 'READ') ||
        hasAccess('sales.team_lead_pipeline', 'READ') ||
        hasAccess('sales.ea_pipeline', 'READ')
      )
    }
    if (item.title === 'Targets') {
      return (
        hasAccess('sales.targets', 'READ') ||
        hasAccess('sales.team_lead_targets', 'READ') ||
        hasAccess('sales.sales_head_targets', 'READ')
      )
    }
    if (item.title === 'Sales Dashboard') {
      return (
        hasAccess('sales.sales_dashboard', 'READ') ||
        hasAccess('sales.md_sales_dashboard', 'READ')
      )
    }
    if (item.title === 'OPD Monitoring') {
      return canAccessSalesOpdMonitoring(role)
    }

    // Full-access roles: allow if parent module is granted
    if (role === 'ADMIN' || role === 'TESTER' || role === 'MD') {
      const moduleKey = resourceKey.split('.')[0]
      if (moduleKey && hasAccess(moduleKey, 'READ')) return true
    }

    return false
  }

  const permitted = itemsWithUrls.filter(filterByPermission)

  const pickSection = (titles: string[] | undefined) => {
    if (!titles?.length) return [] as NavItemWithUrl[]
    return orderByTitles(permitted, titles)
  }

  let primaryMainItems: NavItemWithUrl[]
  let hrItems: NavItemWithUrl[] = []
  let myHrmsItems: NavItemWithUrl[] = []
  let salesItems: NavItemWithUrl[] = []
  let insurancePlItems: NavItemWithUrl[] = []
  let financeItems: NavItemWithUrl[] = []
  let crmItems: NavItemWithUrl[] = []

  if (layout) {
    // mediend AI is footer-only — never place it in main even if listed in a layout
    primaryMainItems = pickSection(layout.main).filter((item) => item.title !== 'mediend AI')
    hrItems = pickSection(layout.hrm)
    myHrmsItems = pickSection(layout.myhrms)
    salesItems = pickSection(layout.sales)
    insurancePlItems = pickSection(layout.insurancePl)
    financeItems = pickSection(layout.finance)
    crmItems = pickSection(layout.crm)
  } else {
    // Fallback for MD / ADMIN / other roles without a fixed layout:
    // permission-filtered catalog with conventional section grouping.
    const HRM_TITLES = [
      'Attendance & Normalizations',
      'People & Org',
      'Compensation & Docs',
      'Engagement',
      'Recruitment',
      'HR Dashboard',
      'Onboarding',
    ]
    const SALES_TITLES = [
      'Sales Dashboard',
      'DM Dashboard',
      'Campaign CPL',
      'Pipeline',
      'Case Tracker',
      'Pending Surgery',
      'Targets',
      'Sales P&L',
      'Incentive',
      'Blue Print Dashboard',
      'OPD Monitoring',
    ]
    const INSURANCE_PL_TITLES = [
      'Insurance',
      'Cash Cases',
      'P/L Ledger',
      'P/L Surgery',
      'P/L Outstanding',
      'Doctor List',
      'Hospital List',
    ]
    const CRM_TITLES = [
      'CRM Campaigns',
      'CRM Incoming Leads',
      'CRM KPIs',
      'CRM Activity',
      'CRM Masters',
      'CRM Access Matrix',
      'CRM Churn Rules',
    ]
    const FINANCE_TITLES = permitted
      .filter((item) => item.title.startsWith('Fin '))
      .map((item) => item.title)

    const sectionTitleSet = new Set([
      ...HRM_TITLES,
      ...SALES_TITLES,
      ...INSURANCE_PL_TITLES,
      ...CRM_TITLES,
      ...FINANCE_TITLES,
    ])

    myHrmsItems = permitted.filter(
      (item) => item.title.startsWith('My ') || item.title === 'Ask MD Approval'
    )
    const myHrmsTitles = new Set(myHrmsItems.map((i) => i.title))

    primaryMainItems = permitted.filter(
      (item) =>
        item.title !== 'mediend AI' &&
        !sectionTitleSet.has(item.title) &&
        !myHrmsTitles.has(item.title)
    )
    hrItems = permitted.filter((item) => HRM_TITLES.includes(item.title))
    salesItems = permitted.filter((item) => SALES_TITLES.includes(item.title))
    insurancePlItems = permitted.filter((item) =>
      INSURANCE_PL_TITLES.includes(item.title)
    )
    financeItems = permitted.filter((item) => item.title.startsWith('Fin '))
    crmItems = permitted.filter((item) => CRM_TITLES.includes(item.title))
  }

  const showHrSection = hrItems.length > 0
  const showMyHrmsSection = myHrmsItems.length > 0
  const showSalesSection = salesItems.length > 0
  const showInsurancePlSection = insurancePlItems.length > 0
  const showFinanceSection = financeItems.length > 0
  const showCrmSection = crmItems.length > 0

  const hrSectionBadge = showHrSection
    ? hrItems.reduce(
      (sum, item) => sum + getBadgeCount(item.title, badgeCounts, !!isMdOrAdmin),
      0
    )
    : 0
  const myHrmsSectionBadge = myHrmsItems.reduce(
    (sum, item) => sum + getBadgeCount(item.title, badgeCounts, !!isMdOrAdmin),
    0
  )

  const renderNavItem = (item: NavItemWithUrl) => {
    const Icon = item.icon
    const isActive = pathname === item.url || pathname.startsWith(item.url + '/')
    const label = displayLabel(item.title)
    const badgeCount =
      item.title === 'Meets'
        ? (badgeCounts as { upcomingMeetsToday?: number } | undefined)?.upcomingMeetsToday ??
        meetNotificationBadge
        : getBadgeCount(item.title, badgeCounts, !!isMdOrAdmin)
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
          <Link href={item.url} onClick={closeSidebarOnMobile}>
            <Icon />
            <span>{label}</span>
            {badgeCount > 0 && (
              <SidebarMenuBadge className="bg-destructive text-white">
                {badgeCount > 99 ? '99+' : badgeCount}
              </SidebarMenuBadge>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const renderCollapsible = (
    key: string,
    label: string,
    icon: React.ReactNode,
    items: NavItemWithUrl[],
    sectionBadge = 0,
    useSub = false
  ) => (
    <SidebarGroup className="pb-1">
      <button
        onClick={() => toggleSection(key)}
        className="text-sidebar-foreground ring-sidebar-ring flex h-9 w-full shrink-0 items-center justify-between rounded-md px-2.5 text-sm font-semibold outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
          {sectionBadge > 0 && (
            <SidebarMenuBadge className="bg-destructive text-white">
              {sectionBadge > 99 ? '99+' : sectionBadge}
            </SidebarMenuBadge>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${openSections[key] ? 'rotate-180' : ''
            }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${openSections[key] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        {openSections[key] && (
          <SidebarGroupContent>
            {useSub ? (
              <SidebarMenuSub className="mx-0 mt-1">
                {items.map((item) => {
                  const isActive =
                    pathname === item.url || pathname.startsWith(item.url + '/')
                  return (
                    <SidebarMenuSubItem key={item.url}>
                      <SidebarMenuSubButton asChild isActive={isActive}>
                        <Link href={item.url} onClick={closeSidebarOnMobile}>
                          <span>{displayLabel(item.title)}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            ) : (
              <SidebarMenu>{items.map(renderNavItem)}</SidebarMenu>
            )}
          </SidebarGroupContent>
        )}
      </div>
    </SidebarGroup>
  )

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-1 p-2">
          <div className="relative h-8 w-32 shrink-0">
            <Image
              src={logo}
              alt="Mediend"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-md text-white font-bold">Workspace Beta</p>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-1">
        <SidebarGroup className="pb-1">
          <SidebarGroupContent>
            <SidebarMenu>{primaryMainItems.map(renderNavItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showCrmSection &&
          renderCollapsible(
            'crm',
            'CRM',
            <Sparkles className="h-4 w-4" />,
            crmItems,
            0,
            true
          )}

        {showHrSection &&
          renderCollapsible(
            'hr',
            'HRM',
            <Users className="h-4 w-4" />,
            hrItems,
            hrSectionBadge
          )}

        {showMyHrmsSection &&
          renderCollapsible(
            'myHrms',
            'MyHrms',
            <UserCircle className="h-4 w-4" />,
            myHrmsItems,
            myHrmsSectionBadge
          )}

        {showSalesSection &&
          renderCollapsible(
            'sales',
            'Sales',
            <TrendingUp className="h-4 w-4" />,
            salesItems
          )}

        {showInsurancePlSection &&
          renderCollapsible(
            'insurancePl',
            'Outstanding & P/L',
            <Shield className="h-4 w-4" />,
            insurancePlItems
          )}

        {showFinanceSection &&
          renderCollapsible(
            'finance',
            'Finance',
            <DollarSign className="h-4 w-4" />,
            financeItems
          )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {isTester && (
            <SidebarMenuItem>
              <div className="px-2 py-2 space-y-1">
                <p className="text-[10px] uppercase text-muted-foreground font-bold">
                  View as role
                </p>
                <select
                  value={user?.role ?? 'TESTER'}
                  onChange={(e) => setActiveRole(e.target.value as UserRole)}
                  className="w-full text-xs border rounded px-2 py-1 bg-background text-foreground"
                >
                  <option value="TESTER">— TESTER (default) —</option>
                  <option value="MD">MD</option>
                  <option value="SALES_HEAD">SALES_HEAD</option>
                  <option value="TEAM_LEAD">TEAM_LEAD</option>
                  <option value="BD">BD</option>
                  <option value="INSURANCE_HEAD">INSURANCE_HEAD</option>
                  <option value="PL_HEAD">PL_HEAD</option>
                  <option value="OUTSTANDING_HEAD">OUTSTANDING_HEAD</option>
                  <option value="HR_HEAD">HR_HEAD</option>
                  <option value="FINANCE_HEAD">FINANCE_HEAD</option>
                  <option value="IT_HEAD">IT_HEAD</option>
                  <option value="EXECUTIVE_ASSISTANT">EXECUTIVE_ASSISTANT</option>
                  <option value="COMPLIANCE_HEAD">COMPLIANCE_HEAD</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="CRM_ADMIN">CRM_ADMIN</option>
                  <option value="USER">USER</option>
                </select>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="mediend AI">
              <Link href="/training" onClick={closeSidebarOnMobile}>
                <Sparkles className="text-purple-400" />
                <span>mediend AI</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
              tooltip={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              asChild={false}
            >
              {isDarkMode ? <Sun /> : <Moon />}
              <span>{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Profile">
              <Link href="/profile" onClick={closeSidebarOnMobile}>
                <User />
                <span>Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()} tooltip="Logout" asChild={false}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
