/**
 * Ordered sidebar structure per role.
 * Titles must match navItems titles in lib/sidebar-nav.ts (or aliases resolved in the sidebar).
 * Layout defines structure; RBAC (nav-resource-map + /api/me/permissions) gates visibility.
 *
 * Note: mediend AI is intentionally omitted from layouts — it always lives in the sidebar footer.
 */

export type RoleSidebarLayout = {
  main: string[]
  hrm?: string[]
  myhrms?: string[]
  sales?: string[]
  insurancePl?: string[]
  finance?: string[]
  crm?: string[]
}

const MYHRMS_STANDARD = [
  'My Core HR',
  'My Financial',
  'My Support & Services',
  'My Team',
] as const

const HRM_CORE = [
  'Attendance & Normalizations',
  'People & Org',
  'Compensation & Docs',
  'Engagement',
] as const

const FINANCE_SECTION = [
  'Fin Payroll',
  'Fin Ledger',
  'Fin New Ledger Entry',
  'Fin Sales',
  'Fin Parties',
  'Fin Heads',
  'Fin Projects',
  'Fin Payment Modes',
  'Fin Inventory',
  'Fin Approvals',
  'Fin Team Approvals',
  'Fin Reports',
  'Fin Invoice Requests',
  'Payment Verifications',
  'Fin Doctor Payoff',
] as const

export const ROLE_SIDEBAR_LAYOUT: Record<string, RoleSidebarLayout> = {
  INSURANCE_HEAD: {
    main: ['Home', 'Tasks', 'Calendar', 'Meets', 'Insurance', 'Cash Cases', 'Chat'],
  },

  COMPLIANCE_HEAD: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'Meets',
      'Chat',
      'Compliance',
      'Cumulative Report',
    ],
  },

  HR_HEAD: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'Meets',
      'Dept Targets',
      'HR Dashboard',
      'Recruitment',
      'Ask MD Approval',
    ],
    hrm: [...HRM_CORE],
  },

  FINANCE_HEAD: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'Meets',
      'Dashboard',
      'Finance Dashboard',
      'P/L Ledger',
      'P/L Outstanding',
      'Doctor List',
      'Hospital List',
      'People & Org',
      'Onboarding',
      'Compensation & Docs',
      'Engagement',
      'Fin Team Approvals',
      'Ask MD Approval',
      'Sales Team Cost',
      'Master Seating Cost',
      'Company P&L',
      'Targeted P&L',
      'P/L',
      'IT P&L',
      'Loan & Demat Revenue',
    ],
    myhrms: [...MYHRMS_STANDARD],
    finance: [...FINANCE_SECTION],
  },

  /** Project Head — Sales / Insurance & P/L as collapsibles; OPD Monitoring under Sales */
  EXECUTIVE_ASSISTANT: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'Meets',
      'Master Data',
      'Doctor Admin',
      'Dept Targets',
      'Blue Print Dashboard',
      'Chat',
      'Attendance & Normalizations',
      'People & Org',
      'Compensation & Docs',
      'Engagement',
      'MD Team Approvals',
      'Cumulative Report',
    ],
    hrm: ['Recruitment', ...HRM_CORE],
    myhrms: [...MYHRMS_STANDARD, 'Ask MD Approval'],
    sales: [
      'Incentive',
      'DM Dashboard',
      'Campaign CPL',
      'Pipeline',
      'Case Tracker',
      'OPD Monitoring',
      'Pending Surgery',
      'Targets',
      'Sales P&L',
    ],
    insurancePl: [
      'Insurance',
      'Cash Cases',
      'P/L Ledger',
      'P/L Surgery',
      'P/L Outstanding',
      'Doctor List',
      'Hospital List',
    ],
  },

  BD: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'IPD/OPD Calendar',
      'Pipeline',
      'Case Tracker',
      'OPD Monitoring',
      'Chat',
      'Ask MD Approval',
    ],
    myhrms: [...MYHRMS_STANDARD],
  },

  /** Flat main — no Sales collapsible */
  TEAM_LEAD: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'IPD/OPD Calendar',
      'Meets',
      'Sales Dashboard',
      'Pipeline',
      'Case Tracker',
      'OPD Monitoring',
      'Pending Surgery',
      'Targets',
      'Chat',
      'Fin Team Approvals',
      'Ask MD Approval',
    ],
    myhrms: [...MYHRMS_STANDARD],
  },

  ASSISTANT_CATEGORY_MANAGER: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'IPD/OPD Calendar',
      'Meets',
      'Sales Dashboard',
      'Pipeline',
      'Case Tracker',
      'OPD Monitoring',
      'Pending Surgery',
      'Targets',
      'Chat',
      'Fin Team Approvals',
      'Ask MD Approval',
    ],
    myhrms: [...MYHRMS_STANDARD],
  },

  /** Flat main — no Sales collapsible (same idea as TL) */
  CATEGORY_MANAGER: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'IPD/OPD Calendar',
      'Meets',
      'Sales Dashboard',
      'Pipeline',
      'Case Tracker',
      'OPD Monitoring',
      'Pending Surgery',
      'Targets',
      'Chat',
      'Ask MD Approval',
    ],
    myhrms: [...MYHRMS_STANDARD],
  },

  /** Flat main — no Sales collapsible */
  SALES_HEAD: {
    main: [
      'Home',
      'Tasks',
      'Calendar',
      'IPD/OPD Calendar',
      'Meets',
      'Sales Dashboard',
      'Incentive',
      'Campaign CPL',
      'Pipeline',
      'Case Tracker',
      'OPD Monitoring',
      'Pending Surgery',
      'Targets',
      'Blue Print Dashboard',
      'Sales P&L',
      'Chat',
      'Ask MD Approval',
    ],
    myhrms: [...MYHRMS_STANDARD],
  },

  SUPER_ADMIN: {
    main: ['Home', 'Tasks', 'Calendar'],
    crm: [
      'CRM Campaigns',
      'CRM Incoming Leads',
      'CRM KPIs',
      'CRM Activity',
      'CRM Masters',
      'CRM Access Matrix',
      'CRM Churn Rules',
    ],
  },

  CRM_ADMIN: {
    main: ['Home', 'Tasks', 'Calendar'],
    crm: [
      'CRM Campaigns',
      'CRM Incoming Leads',
      'CRM KPIs',
      'CRM Activity',
      'CRM Access Matrix',
      'CRM Churn Rules',
    ],
  },

  ACCESS_MATRIX: {
    main: ['IT Permissions'],
  },
}

/** Alias titles used in layouts that map to a different navItems title. */
export const NAV_TITLE_ALIASES: Record<string, string> = {
  'P/L': 'MD P&L',
  'Team Approvals': 'Fin Team Approvals',
}

export function resolveLayoutTitle(title: string): string {
  return NAV_TITLE_ALIASES[title] ?? title
}

/**
 * Returns the layout for a role. Roles without an explicit layout fall back to
 * permission-only filtering of the full nav catalog (legacy / MD / ADMIN).
 */
export function getRoleSidebarLayout(role: string): RoleSidebarLayout | null {
  return ROLE_SIDEBAR_LAYOUT[role] ?? null
}

/** All titles that appear in any section of the layout (for membership checks). */
export function getLayoutTitleSet(layout: RoleSidebarLayout): Set<string> {
  const titles = new Set<string>()
  for (const t of layout.main) titles.add(resolveLayoutTitle(t))
  for (const t of layout.hrm ?? []) titles.add(resolveLayoutTitle(t))
  for (const t of layout.myhrms ?? []) titles.add(resolveLayoutTitle(t))
  for (const t of layout.sales ?? []) titles.add(resolveLayoutTitle(t))
  for (const t of layout.insurancePl ?? []) titles.add(resolveLayoutTitle(t))
  for (const t of layout.finance ?? []) titles.add(resolveLayoutTitle(t))
  for (const t of layout.crm ?? []) titles.add(resolveLayoutTitle(t))
  return titles
}
