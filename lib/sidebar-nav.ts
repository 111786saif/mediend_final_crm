import * as React from 'react'
import {
  Activity,
  Armchair,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  FolderTree,
  GraduationCap,
  Heart,
  Home,
  Inbox,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  PieChart,
  Plus,
  Route,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  UserCheck,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { SessionUser } from '@/lib/auth'
import { hasPermission, hasPlOrFinanceRead, type Permission } from '@/lib/rbac'

export interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  permission?: Permission
  roles?: string[]
}

export const navItems: NavItem[] = [
  {
    title: 'Home',
    url: '/home',
    icon: Home,
  },
  {
    title: 'MD Home',
    url: '/md/home',
    icon: LayoutDashboard,
    roles: ['MD', 'ADMIN'],
  },
  {
    title: 'Tasks',
    url: '/md/tasks',
    icon: ClipboardList,
  },
  {
    title: 'Calendar',
    url: '/calendar',
    icon: CalendarDays,
  },
  {
    title: 'IPD Calendar',
    url: '/ipd-calendar',
    icon: Stethoscope,
    roles: ['BD', 'TEAM_LEAD', 'ASSISTANT_CATEGORY_MANAGER', 'CATEGORY_MANAGER'],
  },
  {
    title: 'Meets',
    url: '/meets',
    icon: Calendar,
  },
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    roles: [
      'SALES_HEAD',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'INSURANCE_HEAD',
      'PL_HEAD',
      'DIGITAL_MARKETING_HEAD',
      'ADMIN',
    ],
  },
  {
    title: 'Sales Dashboard',
    url: '/md/sales',
    icon: TrendingUp,
    roles: [
      'MD',
      'ADMIN',
      'SALES_HEAD',
      'CATEGORY_MANAGER',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'DIGITAL_MARKETING_HEAD',
      'EXECUTIVE_ASSISTANT',
    ],
  },
  {
    title: 'Incentive',
    url: '/incentives',
    icon: Award,
    roles: ['MD', 'ADMIN', 'SALES_HEAD', 'EXECUTIVE_ASSISTANT', 'FINANCE_HEAD'],
  },
  {
    title: 'Finance Dashboard',
    url: '/md/finance',
    icon: DollarSign,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'MD HR Dashboard',
    url: '/md/hr',
    icon: Users,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'MD Attendance',
    url: '/md/attendance',
    icon: CalendarCheck,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'MD Leave balances',
    url: '/md/leave-balances',
    icon: CalendarDays,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Master Data',
    url: '/master-data',
    icon: Database,
    roles: ['EXECUTIVE_ASSISTANT', 'MD', 'ADMIN', 'TESTER', 'PL_HEAD'],
  },
  {
    title: 'Doctor Admin',
    url: '/executive-assistant/doctor-admin',
    icon: Stethoscope,
    roles: ['EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'DM Dashboard',
    url: '/digital-marketing/dashboard',
    icon: Megaphone,
    roles: ['DIGITAL_MARKETING_HEAD', 'MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Campaign CPL',
    url: '/digital-marketing/cpl',
    icon: Target,
    roles: [
      'MD',
      'ADMIN',
      'TESTER',
      'DIGITAL_MARKETING_HEAD',
      'SALES_HEAD',
      'TEAM_LEAD',
      'BD',
      'INSURANCE_HEAD',
      'COMPLIANCE_HEAD',
      'IT_HEAD',
      'HR_HEAD',
    ],
  },
  {
    title: 'CRM Campaigns',
    url: '/crm/campaigns',
    icon: Megaphone,
    roles: ['SUPER_ADMIN', 'CRM_ADMIN'],
  },
  {
    title: 'CRM Incoming Leads',
    url: '/crm/incoming-leads',
    icon: Inbox,
    roles: [
      'SUPER_ADMIN',
      'CRM_ADMIN',
      'BD',
      'TEAM_LEAD',
      'CATEGORY_MANAGER',
      'ASSISTANT_CATEGORY_MANAGER',
      'SALES_HEAD',
    ],
  },
  {
    title: 'CRM KPIs',
    url: '/crm/kpis',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'CRM_ADMIN'],
  },
  {
    title: 'CRM Activity',
    url: '/crm/activity',
    icon: Activity,
    roles: ['SUPER_ADMIN', 'CRM_ADMIN'],
  },
  {
    title: 'CRM Masters',
    url: '/crm/masters',
    icon: Database,
    roles: ['SUPER_ADMIN'],
  },
  {
    title: 'CRM Access Matrix',
    url: '/crm/access-matrix',
    icon: ShieldCheck,
    roles: ['SUPER_ADMIN', 'CRM_ADMIN'],
  },
  {
    title: 'CRM Churn Rules',
    url: '/crm/churn-rules',
    icon: Route,
    roles: [
      'SUPER_ADMIN',
      'CRM_ADMIN',
      'ADMIN',
      'SALES_HEAD',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
    ],
  },
  // {
  //   title: 'CRM Assignment Rules',
  //   url: '/crm/assignment-rules',
  //   icon: FolderTree,
  //   roles: ['SUPER_ADMIN', 'CRM_ADMIN'],
  // },
  {
    title: 'Dept Targets',
    url: '/md/targets',
    icon: Target,
    roles: ['MD', 'ADMIN', 'SALES_HEAD', 'HR_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'HR Dashboard',
    url: '/hr/dashboard',
    icon: Users,
    roles: ['HR_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Recruitment',
    url: '/hr/recruitment',
    icon: UserCheck,
    permission: 'hrms:recruitment:read',
  },
  {
    title: 'Pipeline',
    url: '/pipeline',
    icon: ClipboardList,
    roles: [
      'BD',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'SALES_HEAD',
      'EXECUTIVE_ASSISTANT',
    ],
  },
  {
    title: 'OPD Monitoring',
    url: '/opd-monitoring',
    icon: CalendarClock,
    roles: [
      'BD',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'SALES_HEAD',
      'EXECUTIVE_ASSISTANT',
      'ADMIN',
      'MD',
      'TESTER',
    ],
  },
  {
    title: 'Case Tracker',
    url: '/bd/kyp',
    icon: FileText,
    roles: [
      'BD',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'SALES_HEAD',
      'EXECUTIVE_ASSISTANT',
      'PL_HEAD',
    ],
  },
  {
    title: 'Pending Surgery',
    url: '/reports/patient-cards-pending-surgery',
    icon: ClipboardList,
    roles: [
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'SALES_HEAD',
      'EXECUTIVE_ASSISTANT',
      'MD',
      'ADMIN',
    ],
  },
  {
    title: 'Targets',
    url: '/sales/targets',
    icon: Target,
    roles: [
      'SALES_HEAD',
      'CATEGORY_MANAGER',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'EXECUTIVE_ASSISTANT',
      'MD',
      'ADMIN',
    ],
  },
  {
    title: 'Blue Print Dashboard',
    url: '/sales/blueprint',
    icon: LayoutDashboard,
    roles: ['SALES_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Sales P&L',
    url: '/sales/pnl',
    icon: PieChart,
  },
  {
    title: 'Insurance',
    url: '/insurance/dashboard',
    icon: Shield,
    permission: 'insurance:read',
  },
  {
    title: 'Cash Cases',
    url: '/insurance/cash-cases',
    icon: Wallet,
    permission: 'insurance:read',
  },
  {
    title: 'Chat',
    url: '/chat',
    icon: MessageSquare,
    roles: [
      'BD',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'INSURANCE',
      'INSURANCE_HEAD',
      'PL_HEAD',
      'PL_ENTRY',
      'PL_VIEWER',
      'ACCOUNTS',
      'ADMIN',
      'TESTER',
      'EXECUTIVE_ASSISTANT',
      'COMPLIANCE_HEAD',
      'DIGITAL_MARKETING_HEAD',
    ],
  },
  {
    title: 'mediend AI',
    url: '/training',
    icon: GraduationCap,
    roles: [
      'MD',
      'SUPER_ADMIN',
      'CRM_ADMIN',
      'EXECUTIVE_ASSISTANT',
      'SALES_HEAD',
      'CATEGORY_MANAGER',
      'ASSISTANT_CATEGORY_MANAGER',
      'TEAM_LEAD',
      'BD',
      'INSURANCE_HEAD',
      'PL_HEAD',
      'OUTSTANDING_HEAD',
      'HR_HEAD',
      'FINANCE_HEAD',
      'DIGITAL_MARKETING_HEAD',
      'IT_HEAD',
      'LOAN_DEMAT_HEAD',
      'COMPLIANCE_HEAD',
      'ADMIN',
      'USER',
      'TESTER',
      'ACCESS_MATRIX',
    ],
  },
  {
    title: 'P/L Ledger',
    url: '/pl/dashboard',
    icon: DollarSign,
    permission: 'pl:read',
  },
  {
    title: 'P/L Surgery',
    url: '/pl/surgery-dashboard',
    icon: BarChart3,
    permission: 'pl:read',
  },
  {
    title: 'P/L Outstanding',
    url: '/pl/outstanding',
    icon: CreditCard,
    permission: 'pl:read',
  },
  {
    title: 'Doctor List',
    url: '/doctors',
    icon: Stethoscope,
    permission: 'pl:read',
  },
  {
    title: 'Hospital List',
    url: '/hospitals',
    icon: Building2,
    permission: 'pl:read',
  },
  {
    title: 'My Core HR',
    url: '/employee/dashboard/core-hr',
    icon: UserCircle,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'ADMIN', 'USER', 'COMPLIANCE_HEAD', 'DIGITAL_MARKETING_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'My Financial',
    url: '/employee/dashboard/financial',
    icon: Wallet,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'ADMIN', 'USER', 'COMPLIANCE_HEAD', 'DIGITAL_MARKETING_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'My Support & Services',
    url: '/employee/dashboard/support-services',
    icon: MessageSquare,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'ADMIN', 'USER', 'COMPLIANCE_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'My Team',
    url: '/employee/my-team',
    icon: Users,
    permission: 'hierarchy:team:read',
  },
  {
    title: 'Attendance & Normalizations',
    url: '/hr/attendance-leaves',
    icon: Clock,
    permission: 'hrms:attendance:read',
  },
  {
    title: 'People & Org',
    url: '/hr/people',
    icon: Users,
    permission: 'hrms:employees:read',
  },
  {
    title: 'Onboarding',
    url: '/hr/onboarding',
    icon: UserCheck,
    permission: 'hrms:employees:read',
  },
  {
    title: 'Compensation & Docs',
    url: '/hr/compensation',
    icon: FileText,
    permission: 'hrms:employees:read',
  },
  {
    title: 'Engagement',
    url: '/hr/engagement',
    icon: MessageSquare,
    permission: 'hrms:employees:read',
  },
  {
    title: 'Fin Payroll',
    url: '/finance/payroll',
    icon: Wallet,
    permission: 'finance:payroll:read',
  },
  {
    title: 'MD Messages',
    url: '/md/anonymous-messages',
    icon: Mail,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'MD Appointments',
    url: '/md/appointments',
    icon: CalendarCheck,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Fin Ledger',
    url: '/finance/ledger',
    icon: BookOpen,
    permission: 'finance:read',
  },
  {
    title: 'Fin New Ledger Entry',
    url: '/finance/ledger/new',
    icon: Plus,
    permission: 'finance:write',
  },
  {
    title: 'Fin Sales',
    url: '/finance/sales',
    icon: IndianRupee,
    permission: 'finance:read',
  },
  {
    title: 'Fin Parties',
    url: '/finance/parties',
    icon: Building2,
    permission: 'finance:read',
  },
  {
    title: 'Fin Heads',
    url: '/finance/heads',
    icon: FolderTree,
    permission: 'finance:read',
  },
  {
    title: 'Fin Projects',
    url: '/finance/projects',
    icon: Target,
    permission: 'finance:read',
  },
  {
    title: 'Fin Payment Modes',
    url: '/finance/payment-modes',
    icon: CreditCard,
    permission: 'finance:read',
  },
  {
    title: 'Fin Inventory',
    url: '/finance/inventory',
    icon: Package,
    permission: 'finance:read',
  },
  {
    title: 'Fin Approvals',
    url: '/md/approvals',
    icon: CheckCircle,
    permission: 'finance:approve',
  },
  {
    title: 'Fin Team Approvals',
    url: '/finance/team-approvals',
    icon: CheckCircle,
    roles: ['FINANCE_HEAD', 'TEAM_LEAD', 'ASSISTANT_CATEGORY_MANAGER'],
  },
  {
    title: 'MD Team Approvals',
    url: '/md/md-approvals',
    icon: CheckCircle,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Ask MD Approval',
    url: '/md/md-approvals',
    icon: CheckCircle,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'EXECUTIVE_ASSISTANT', 'USER', 'DIGITAL_MARKETING_HEAD', 'OUTSTANDING_HEAD', 'IT_HEAD'],
  },
  {
    title: 'Fin Reports',
    url: '/finance/reports',
    icon: BarChart3,
    permission: 'finance:read',
  },
  {
    title: 'Fin Invoice Requests',
    url: '/finance/invoice-requests',
    icon: FileText,
    permission: 'finance:read',
  },
  {
    title: 'Payment Verifications',
    url: '/finance/payment-verifications',
    icon: ShieldCheck,
    permission: 'finance:read',
  },
  {
    title: 'Fin Doctor Payoff',
    url: '/finance/doctor-payoff-requests',
    icon: Stethoscope,
    permission: 'finance:read',
  },
  {
    title: 'Sales Team Cost',
    url: '/finance/sales-team-cost',
    icon: DollarSign,
    permission: 'finance:read',
  },
  {
    title: 'Master Seating Cost',
    url: '/finance/master-seating-cost',
    icon: Armchair,
    roles: ['FINANCE_HEAD', 'ADMIN'],
  },
  {
    title: 'Company P&L',
    url: '/finance/pnl',
    icon: PieChart,
    permission: 'pnl:read',
  },
  {
    title: 'Targeted P&L',
    url: '/finance/pnl/targeted',
    icon: Target,
    permission: 'pnl:write',
  },
  {
    title: 'MD P&L',
    url: '/md/pnl',
    icon: TrendingUp,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'IT P&L',
    url: '/it/pnl',
    icon: LayoutDashboard,
    permission: 'it:pnl:read',
  },
  {
    title: 'Loan & Demat Revenue',
    url: '/loan-demat/revenue',
    icon: IndianRupee,
    roles: ['FINANCE_HEAD', 'MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'IT Permissions',
    url: '/it/permissions',
    icon: ShieldCheck,
    permission: 'it:permissions',
  },
  {
    title: 'Compliance',
    url: '/compliance/dashboard',
    icon: Stethoscope,
    roles: ['COMPLIANCE_HEAD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'MD Compliance',
    url: '/md/compliance',
    icon: Star,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'MD Outstanding',
    url: '/md/outstanding',
    icon: CreditCard,
    roles: ['MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Cumulative Report',
    url: '/cumulative-report',
    icon: BarChart3,
    permission: 'main.cumulative_report',
  },
]

export function getCampaignCplNavItem(): NavItem & { url: string } {
  const item = navItems.find((entry) => entry.title === 'Campaign CPL')
  if (!item?.url) {
    return {
      title: 'Campaign CPL',
      url: '/digital-marketing/cpl',
      icon: Target,
    }
  }
  return item as NavItem & { url: string }
}

export function getDashboardUrl(role: string): string {
  if (role === 'SALES_HEAD') return '/sales/dashboard'
  if (role === 'CATEGORY_MANAGER') return '/sales/dashboard'
  if (role === 'TEAM_LEAD' || role === 'ASSISTANT_CATEGORY_MANAGER') return '/team-lead/dashboard'
  if (role === 'COMPLIANCE_HEAD') return '/compliance/dashboard'
  if (role === 'DIGITAL_MARKETING_HEAD') return '/digital-marketing/dashboard'
  if (role === 'PL_HEAD') return '/pl/surgery-dashboard'
  if (role === 'INSURANCE_HEAD') return '/insurance/dashboard'
  if (role === 'OUTSTANDING_HEAD') return '/pl/outstanding'
  if (role === 'FINANCE_HEAD') return '/md/finance'
  return '/md/tasks'
}

function dedupeNavItemsByUrl(items: (NavItem & { url: string })[]): (NavItem & { url: string })[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    // Keep distinct nav labels even when they share a URL (e.g. Dashboard + P/L Surgery).
    const key = `${item.title}::${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function filterNavItems(user: SessionUser | null): NavItem[] {
  if (!user) return []
  if (user.role === 'ACCESS_MATRIX') {
    return navItems.filter((item) => item.title === 'IT Permissions')
  }
  return navItems
}

function mapItemUrls(items: NavItem[], role: string): (NavItem & { url: string })[] {
  return items.map((item) => {
    if (item.title === 'Dashboard') {
      return { ...item, url: getDashboardUrl(role) }
    }
    if (item.title === 'Sales Dashboard') {
      if (role === 'SALES_HEAD' || role === 'CATEGORY_MANAGER') {
        return { ...item, url: '/sales/dashboard' }
      }
      if (role === 'TEAM_LEAD' || role === 'ASSISTANT_CATEGORY_MANAGER') {
        return { ...item, url: '/team-lead/dashboard' }
      }
    }
    if (item.title === 'Pipeline') {
      if (role === 'BD') return { ...item, url: '/bd/pipeline' }
      if (role === 'TEAM_LEAD' || role === 'ASSISTANT_CATEGORY_MANAGER') {
        return { ...item, url: '/team-lead/pipeline' }
      }
      if (role === 'CATEGORY_MANAGER') return { ...item, url: '/team-lead/pipeline' }
      if (role === 'SALES_HEAD') return { ...item, url: '/team-lead/pipeline' }
      if (role === 'EXECUTIVE_ASSISTANT') return { ...item, url: '/executive-assistant/pipeline' }
      if (role === 'ADMIN') return { ...item, url: '/bd/pipeline' }
    }
    if (item.title === 'Targets') {
      if (role === 'CATEGORY_MANAGER') return { ...item, url: '/sales/targets' }
      if (role === 'TEAM_LEAD' || role === 'ASSISTANT_CATEGORY_MANAGER') {
        return { ...item, url: '/team-lead/targets' }
      }
      if (role === 'SALES_HEAD' || role === 'EXECUTIVE_ASSISTANT' || role === 'MD' || role === 'ADMIN') {
        return { ...item, url: '/sales-head/targets' }
      }
    }
    return item
  })
}

/**
 * Returns the full list of nav items allowed for the user, with URLs resolved (dashboard, pipeline, etc.).
 * Same order as sidebar. Used by sidebar and by getFirstNavUrl.
 */
export function getFilteredNavItemsWithUrls(user: SessionUser | null): (NavItem & { url: string })[] {
  const filtered = filterNavItems(user)
  return dedupeNavItemsByUrl(mapItemUrls(filtered, user?.role ?? ''))
}

/**
 * Returns the URL of the first nav item for the user (first link they see in the sidebar).
 * Use for post-login and root redirect so users never hit 404.
 */
export function getFirstNavUrl(user: SessionUser | null): string {
  // MD/ADMIN land on the MD Command Center; Project Head and others on /home
  if (user) {
    if (user.role === 'MD' || user.role === 'ADMIN') return '/md/home'
    if (String(user.role) === 'SUPER_ADMIN') return '/crm/campaigns'
    if (String(user.role) === 'CRM_ADMIN') return '/crm/access-matrix'
    if (user.role === 'COMPLIANCE_HEAD') return '/compliance/dashboard'
    if (user.role === 'ACCESS_MATRIX') return '/it/permissions'
    return '/home'
  }
  const items = getFilteredNavItemsWithUrls(user)
  const first = items[0]
  return first?.url ?? '/dashboard'
}
