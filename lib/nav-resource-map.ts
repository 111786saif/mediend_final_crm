/**
 * Explicit sidebar title → RBAC resource.key mapping.
 * Used by the sidebar to gate nav items via /api/me/permissions (default deny).
 */

export const NAV_TITLE_TO_RESOURCE: Record<string, string> = {
  Home: 'main.home',
  'MD Home': 'main.md_home',
  Tasks: 'main.tasks',
  Calendar: 'main.calendar',
  'IPD/OPD Calendar': 'main.ipd_calendar',
  Meets: 'main.meets',
  Dashboard: 'main.dashboard',
  'Sales Dashboard': 'sales.sales_dashboard',
  Incentive: 'main.incentive',
  'Finance Dashboard': 'main.finance_dashboard',
  'MD HR Dashboard': 'main.md_hr_dashboard',
  'MD Attendance': 'main.md_attendance',
  'MD Leave balances': 'main.md_leave_balances',
  'Master Data': 'main.master_data',
  'Doctor Admin': 'main.doctor_admin',
  'DM Dashboard': 'sales.dm_dashboard',
  'Campaign CPL': 'sales.campaign_cpl',
  'CRM Campaigns': 'crm.campaigns',
  'CRM Incoming Leads': 'crm.incoming_leads',
  'CRM KPIs': 'crm.kpis',
  'CRM Activity': 'crm.activity',
  'CRM Masters': 'crm.masters',
  'CRM Access Matrix': 'crm.access_matrix',
  'CRM Churn Rules': 'crm.churn_rules',
  'Dept Targets': 'main.dept_targets',
  'HR Dashboard': 'hrm.hr_dashboard',
  Recruitment: 'hrm.recruitment',
  Pipeline: 'sales.sales_pipeline', // role-resolved below
  'OPD Monitoring': 'sales.opd_monitoring',
  'Case Tracker': 'sales.case_tracker',
  'Pending Surgery': 'sales.pending_surgery',
  Targets: 'sales.targets', // role-resolved below
  'Blue Print Dashboard': 'sales.blueprint_dashboard',
  'Sales P&L': 'sales.sales_pnl',
  Insurance: 'insurance_pl.insurance',
  'Cash Cases': 'insurance_pl.cash_cases',
  Chat: 'main.chat',
  'mediend AI': 'main.training',
  'P/L Ledger': 'insurance_pl.pl_ledger',
  'P/L Surgery': 'insurance_pl.pl_surgery',
  'P/L Outstanding': 'insurance_pl.pl_outstanding',
  'Doctor List': 'insurance_pl.doctor_list',
  'Hospital List': 'insurance_pl.hospital_list',
  'My Core HR': 'myhrms.my_core_hr',
  'My Financial': 'myhrms.my_financial',
  'My Support & Services': 'myhrms.my_support_services',
  'My Team': 'myhrms.my_team',
  'Attendance & Normalizations': 'hrm.attendance_normalizations',
  'People & Org': 'hrm.people_org',
  Onboarding: 'hrm.onboarding',
  'Compensation & Docs': 'hrm.compensation_docs',
  Engagement: 'hrm.engagement',
  'Fin Payroll': 'finance.fin_payroll',
  'MD Messages': 'main.md_messages',
  'MD Appointments': 'main.md_appointments',
  'Fin Ledger': 'finance.fin_ledger',
  'Fin New Ledger Entry': 'finance.fin_new_ledger_entry',
  'Fin Sales': 'finance.fin_sales',
  'Fin Parties': 'finance.fin_parties',
  'Fin Heads': 'finance.fin_heads',
  'Fin Projects': 'finance.fin_projects',
  'Fin Payment Modes': 'finance.fin_payment_modes',
  'Fin Inventory': 'finance.fin_inventory',
  'Fin Approvals': 'finance.fin_approvals',
  'Fin Team Approvals': 'finance.fin_team_approvals',
  'Team Approvals': 'finance.fin_team_approvals',
  'MD Team Approvals': 'finance.md_team_approvals',
  'Ask MD Approval': 'myhrms.ask_md_approval',
  'Fin Reports': 'finance.fin_reports',
  'Fin Invoice Requests': 'finance.fin_invoice_requests',
  'Payment Verifications': 'finance.payment_verifications',
  'Fin Doctor Payoff': 'finance.fin_doctor_payoff',
  'Sales Team Cost': 'finance.fin_sales_team_cost',
  'Master Seating Cost': 'finance.master_seating_cost',
  'Company P&L': 'main.company_pnl',
  'Targeted P&L': 'main.targeted_pnl',
  'MD P&L': 'main.md_pnl',
  'P/L': 'main.md_pnl',
  'IT P&L': 'main.it_pnl',
  'Loan & Demat Revenue': 'main.loan_demat_revenue',
  'IT Permissions': 'main.it_permissions',
  Compliance: 'main.compliance',
  'MD Compliance': 'main.md_compliance',
  'MD Outstanding': 'main.md_outstanding',
  'Cumulative Report': 'main.cumulative_report',
}

/** Role-specific resource keys for Pipeline / Targets / Sales Dashboard. */
export function resolveNavResourceKey(title: string, role: string): string | null {
  if (title === 'Pipeline') {
    if (role === 'BD') return 'sales.sales_pipeline'
    if (role === 'TEAM_LEAD' || role === 'ASSISTANT_CATEGORY_MANAGER' || role === 'CATEGORY_MANAGER') {
      return 'sales.team_lead_pipeline'
    }
    if (role === 'SALES_HEAD') return 'sales.team_lead_pipeline'
    if (role === 'EXECUTIVE_ASSISTANT') return 'sales.ea_pipeline'
    return 'sales.sales_pipeline'
  }

  if (title === 'Targets') {
    if (role === 'TEAM_LEAD' || role === 'ASSISTANT_CATEGORY_MANAGER') {
      return 'sales.team_lead_targets'
    }
    if (role === 'SALES_HEAD' || role === 'EXECUTIVE_ASSISTANT' || role === 'MD' || role === 'ADMIN') {
      return 'sales.sales_head_targets'
    }
    return 'sales.targets'
  }

  if (title === 'Sales Dashboard') {
    if (role === 'MD' || role === 'ADMIN' || role === 'EXECUTIVE_ASSISTANT') {
      return 'sales.md_sales_dashboard'
    }
    return 'sales.sales_dashboard'
  }

  return NAV_TITLE_TO_RESOURCE[title] ?? null
}
