import * as React from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CalendarDays,
  CalendarCheck,
  CheckCircle,
  ClipboardList,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  FolderTree,
  Home,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  Mail,
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
  Megaphone,
  Wallet,
} from 'lucide-react'
import { SessionUser } from '@/lib/auth'
import { hasPermission, type Permission } from '@/lib/rbac'

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
    title: 'Meets',
    url: '/meets',
    icon: Calendar,
  },
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'DIGITAL_MARKETING_HEAD', 'ADMIN'],
  },
  {
    title: 'Sales Dashboard',
    url: '/md/sales',
    icon: TrendingUp,
    roles: ['MD', 'ADMIN', 'SALES_HEAD', 'DIGITAL_MARKETING_HEAD', 'EXECUTIVE_ASSISTANT'],
  },
  {
    title: 'Finance Dashboard',
    url: '/md/finance',
    icon: DollarSign,
    roles: ['MD', 'ADMIN'],
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
    roles: ['MD', 'ADMIN'],
  },
  {
    title: 'MD Leave balances',
    url: '/md/leave-balances',
    icon: CalendarDays,
    roles: ['MD', 'ADMIN'],
  },
  {
    title: 'Master Data',
    url: '/master-data',
    icon: Database,
    roles: ['EXECUTIVE_ASSISTANT', 'MD', 'ADMIN', 'TESTER', 'PL_HEAD'],
  },
  {
    title: 'DM Dashboard',
    url: '/digital-marketing/dashboard',
    icon: Megaphone,
    roles: ['DIGITAL_MARKETING_HEAD', 'MD', 'ADMIN', 'EXECUTIVE_ASSISTANT'],
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
    roles: ['SUPER_ADMIN', 'CRM_ADMIN', 'ADMIN', 'SALES_HEAD', 'TEAM_LEAD'],
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
    roles: ['MD', 'ADMIN', 'SALES_HEAD', 'HR_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD'],
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
    roles: ['BD', 'TEAM_LEAD'],
  },
  {
    title: 'Case Tracker',
    url: '/bd/kyp',
    icon: FileText,
    roles: ['BD', 'TEAM_LEAD', 'SALES_HEAD', 'EXECUTIVE_ASSISTANT', 'PL_HEAD'],
  },
  {
    title: 'Pending Surgery',
    url: '/reports/patient-cards-pending-surgery',
    icon: ClipboardList,
    roles: ['TEAM_LEAD', 'SALES_HEAD', 'EXECUTIVE_ASSISTANT', 'MD', 'ADMIN'],
  },
  {
    title: 'Targets',
    url: '/sales/targets',
    icon: Target,
    roles: ['SALES_HEAD', 'TEAM_LEAD', 'EXECUTIVE_ASSISTANT'],
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
    roles: ['BD', 'TEAM_LEAD', 'INSURANCE', 'INSURANCE_HEAD', 'PL_HEAD', 'PL_ENTRY', 'PL_VIEWER', 'ACCOUNTS', 'ADMIN', 'TESTER', 'EXECUTIVE_ASSISTANT', 'COMPLIANCE_HEAD', 'DIGITAL_MARKETING_HEAD'],
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
    roles: ['MD', 'ADMIN'],
  },
  {
    title: 'MD Appointments',
    url: '/md/appointments',
    icon: CalendarCheck,
    roles: ['MD', 'ADMIN'],
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
    roles: ['FINANCE_HEAD'],
  },
  {
    title: 'MD Team Approvals',
    url: '/md/md-approvals',
    icon: CheckCircle,
    roles: ['MD', 'ADMIN'],
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
    roles: ['MD', 'ADMIN'],
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
    roles: ['FINANCE_HEAD', 'MD', 'ADMIN'],
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
    roles: ['MD', 'ADMIN'],
  },
  {
    title: 'MD Outstanding',
    url: '/md/outstanding',
    icon: CreditCard,
    roles: ['MD', 'ADMIN'],
  },
]

/** Merged in app-sidebar when user has `cpl_access` (IT Permissions). Not in `navItems`. */
export function getCampaignCplNavItem(): NavItem & { url: string } {
  return {
    title: 'Campaign CPL',
    url: '/digital-marketing/cpl',
    icon: Target,
  }
}

export function getDashboardUrl(role: string): string {
  if (role === 'SALES_HEAD') return '/sales/dashboard'
  if (role === 'TEAM_LEAD') return '/team-lead/dashboard'
  if (role === 'COMPLIANCE_HEAD') return '/compliance/dashboard'
  if (role === 'DIGITAL_MARKETING_HEAD') return '/pl/dashboard'
  return '/md/tasks'
}

function filterNavItems(user: SessionUser | null): NavItem[] {
  if (!user) return []
  return navItems.filter((item) => {
    if (item.title === 'Home' || item.title === 'Tasks' || item.title === 'Calendar') return true
    if (item.title === 'Meets') return user.role !== 'BD'
    // Sales Head: "Sales Dashboard" already points to /sales/dashboard; generic "Dashboard" would duplicate it
    if (item.title === 'Dashboard' && user.role === 'SALES_HEAD') {
      return false
    }
    // Company P&L (/finance/pnl): Finance Head, MD, Admin only (not TESTER / other roles with broad nav)
    if (item.title === 'Company P&L') {
      return user.role === 'FINANCE_HEAD' || user.role === 'MD' || user.role === 'ADMIN'
    }
    // Targeted P&L: same access as Company P&L
    if (item.title === 'Targeted P&L') {
      return user.role === 'FINANCE_HEAD' || user.role === 'MD' || user.role === 'ADMIN'
    }
    if (item.title === 'Sales P&L') {
      return hasPermission(user, 'sales:pnl:read')
    }
    // IT P&L overview: IT Head, Finance Head, MD, Admin only (not Sales Head / TESTER broad nav)
    if (item.title === 'IT P&L') {
      return user.role === 'IT_HEAD' || user.role === 'FINANCE_HEAD' || user.role === 'MD' || user.role === 'ADMIN'
    }
    if (user.role === 'MD') {
      return (
        item.title === 'Sales Dashboard' ||
        item.title === 'Finance Dashboard' ||
        item.title === 'MD HR Dashboard' ||
        item.title === 'Recruitment' ||
        item.title === 'Loan & Demat Revenue' ||
        item.title === 'DM Dashboard' ||
        item.title === 'Targeted P&L' ||
        item.title.startsWith('MD ') ||
        (item.title === 'Master Data' && item.roles?.includes('MD'))
      )
    }
    // USER role can only see Tasks + "My " prefixed pages (MyHRMS)
    if (user.role === 'USER') {
      return item.title === 'Tasks' || item.title.startsWith('My ')
    }
    if (item.title.startsWith('My ') || item.title.startsWith('Svc ')) {
      return true
    }
    if (user.role === 'ADMIN' || user.role === 'TESTER') {
      // Exclude HR_HEAD-only HR Dashboard to avoid duplicate (ADMIN sees MD HR Dashboard)
      if (item.title === 'HR Dashboard' && item.url === '/hr/dashboard') return false
      return true
    }
    if (item.roles) {
      return item.roles.includes(user.role)
    }
    if (item.permission) {
      return hasPermission(user, item.permission)
    }
    return false
  })
}

function mapItemUrls(items: NavItem[], role: string): (NavItem & { url: string })[] {
  return items.map((item) => {
    if (item.title === 'Dashboard') {
      return { ...item, url: getDashboardUrl(role) }
    }
    if (item.title === 'Sales Dashboard' && role === 'SALES_HEAD') {
      return { ...item, url: '/sales/dashboard' }
    }
    if (item.title === 'Pipeline') {
      if (role === 'BD') return { ...item, url: '/bd/pipeline' }
      if (role === 'TEAM_LEAD') return { ...item, url: '/team-lead/pipeline' }
      if (role === 'ADMIN') return { ...item, url: '/bd/pipeline' }
    }
    if (item.title === 'Targets') {
      if (role === 'TEAM_LEAD') return { ...item, url: '/team-lead/targets' }
      if (role === 'EXECUTIVE_ASSISTANT') return { ...item, url: '/executive-assistant/targets' }
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
  return mapItemUrls(filtered, user?.role ?? '')
}

/**
 * Returns the URL of the first nav item for the user (first link they see in the sidebar).
 * Use for post-login and root redirect so users never hit 404.
 */
export function getFirstNavUrl(user: SessionUser | null): string {
  // MD/ADMIN land on the MD Command Center; everyone else on the generic home page
  if (user) {
    if (user.role === 'MD' || user.role === 'ADMIN') return '/md/home'
    if (String(user.role) === 'SUPER_ADMIN') return '/crm/campaigns'
    if (String(user.role) === 'CRM_ADMIN') return '/crm/access-matrix'
    if (user.role === 'COMPLIANCE_HEAD') return '/compliance/dashboard'
    return '/home'
  }
  const items = getFilteredNavItemsWithUrls(user)
  const first = items[0]
  return first?.url ?? '/dashboard'
}
