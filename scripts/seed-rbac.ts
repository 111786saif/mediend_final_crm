import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { ResourceType } from '../generated/prisma/client'

interface ResourceSeedItem {
  key: string
  label: string
  type: ResourceType
  parentKey: string | null
  sortOrder: number
}

const resourcesToSeed: ResourceSeedItem[] = [
  // MODULES (top-level sections / containers)
  { key: 'main', label: 'Main Navigation', type: 'MODULE', parentKey: null, sortOrder: 1 },
  { key: 'hrm', label: 'Human Resource Management', type: 'MODULE', parentKey: null, sortOrder: 2 },
  { key: 'myhrms', label: 'My HRMS Portal', type: 'MODULE', parentKey: null, sortOrder: 3 },
  { key: 'sales', label: 'Sales & Marketing', type: 'MODULE', parentKey: null, sortOrder: 4 },
  { key: 'insurance_pl', label: 'Insurance & P/L', type: 'MODULE', parentKey: null, sortOrder: 5 },
  { key: 'finance', label: 'Finance & Accounts', type: 'MODULE', parentKey: null, sortOrder: 6 },
  { key: 'actions', label: 'System Actions', type: 'MODULE', parentKey: null, sortOrder: 7 },
  { key: 'crm', label: 'CRM', type: 'MODULE', parentKey: null, sortOrder: 8 },

  // SECTIONS (individual pages or sub-sections)
  
  // Under main
  { key: 'main.home', label: 'Home', type: 'SECTION', parentKey: 'main', sortOrder: 1 },
  { key: 'main.md_home', label: 'MD Home', type: 'SECTION', parentKey: 'main', sortOrder: 2 },
  { key: 'main.tasks', label: 'Tasks', type: 'SECTION', parentKey: 'main', sortOrder: 3 },
  { key: 'main.calendar', label: 'Calendar', type: 'SECTION', parentKey: 'main', sortOrder: 4 },
  { key: 'main.meets', label: 'Meets', type: 'SECTION', parentKey: 'main', sortOrder: 5 },
  { key: 'main.dashboard', label: 'Dashboard', type: 'SECTION', parentKey: 'main', sortOrder: 6 },
  { key: 'main.finance_dashboard', label: 'Finance Dashboard', type: 'SECTION', parentKey: 'main', sortOrder: 7 },
  { key: 'main.md_hr_dashboard', label: 'MD HR Dashboard', type: 'SECTION', parentKey: 'main', sortOrder: 8 },
  { key: 'main.md_attendance', label: 'MD Attendance', type: 'SECTION', parentKey: 'main', sortOrder: 9 },
  { key: 'main.md_leave_balances', label: 'MD Leave Balances', type: 'SECTION', parentKey: 'main', sortOrder: 10 },
  { key: 'main.master_data', label: 'Master Data', type: 'SECTION', parentKey: 'main', sortOrder: 11 },
  { key: 'main.dept_targets', label: 'Dept Targets', type: 'SECTION', parentKey: 'main', sortOrder: 12 },
  { key: 'main.chat', label: 'Chat', type: 'SECTION', parentKey: 'main', sortOrder: 13 },
  { key: 'main.md_messages', label: 'MD Messages', type: 'SECTION', parentKey: 'main', sortOrder: 14 },
  { key: 'main.md_appointments', label: 'MD Appointments', type: 'SECTION', parentKey: 'main', sortOrder: 15 },
  { key: 'main.company_pnl', label: 'Company P&L', type: 'SECTION', parentKey: 'main', sortOrder: 16 },
  { key: 'main.targeted_pnl', label: 'Targeted P&L', type: 'SECTION', parentKey: 'main', sortOrder: 17 },
  { key: 'main.md_pnl', label: 'MD P&L', type: 'SECTION', parentKey: 'main', sortOrder: 18 },
  { key: 'main.it_pnl', label: 'IT P&L', type: 'SECTION', parentKey: 'main', sortOrder: 19 },
  { key: 'main.loan_demat_revenue', label: 'Loan & Demat Revenue', type: 'SECTION', parentKey: 'main', sortOrder: 20 },
  { key: 'main.it_permissions', label: 'IT Permissions', type: 'SECTION', parentKey: 'main', sortOrder: 21 },
  { key: 'main.compliance', label: 'Compliance', type: 'SECTION', parentKey: 'main', sortOrder: 22 },
  { key: 'main.md_compliance', label: 'MD Compliance', type: 'SECTION', parentKey: 'main', sortOrder: 23 },
  { key: 'main.md_outstanding', label: 'MD Outstanding', type: 'SECTION', parentKey: 'main', sortOrder: 24 },
  { key: 'main.incentive', label: 'Incentive', type: 'SECTION', parentKey: 'main', sortOrder: 25 },
  { key: 'main.cumulative_report', label: 'Cumulative Report', type: 'SECTION', parentKey: 'main', sortOrder: 26 },
  { key: 'main.ipd_calendar', label: 'IPD Calendar', type: 'SECTION', parentKey: 'main', sortOrder: 27 },
  { key: 'main.doctor_admin', label: 'Doctor Admin', type: 'SECTION', parentKey: 'main', sortOrder: 28 },
  { key: 'main.training', label: 'Training', type: 'SECTION', parentKey: 'main', sortOrder: 29 },


  // Under hrm
  { key: 'hrm.hr_dashboard', label: 'HR Dashboard', type: 'SECTION', parentKey: 'hrm', sortOrder: 0 },
  { key: 'hrm.attendance_normalizations', label: 'Attendance & Normalizations', type: 'SECTION', parentKey: 'hrm', sortOrder: 1 },
  { key: 'hrm.people_org', label: 'People & Org', type: 'SECTION', parentKey: 'hrm', sortOrder: 2 },
  { key: 'hrm.onboarding', label: 'Onboarding', type: 'SECTION', parentKey: 'hrm', sortOrder: 3 },
  { key: 'hrm.compensation_docs', label: 'Compensation & Docs', type: 'SECTION', parentKey: 'hrm', sortOrder: 4 },
  { key: 'hrm.engagement', label: 'Engagement', type: 'SECTION', parentKey: 'hrm', sortOrder: 5 },
  { key: 'hrm.recruitment', label: 'Recruitment', type: 'SECTION', parentKey: 'hrm', sortOrder: 6 },

  // Under myhrms
  { key: 'myhrms.my_core_hr', label: 'My Core HR', type: 'SECTION', parentKey: 'myhrms', sortOrder: 1 },
  { key: 'myhrms.my_financial', label: 'My Financial', type: 'SECTION', parentKey: 'myhrms', sortOrder: 2 },
  { key: 'myhrms.my_support_services', label: 'My Support & Services', type: 'SECTION', parentKey: 'myhrms', sortOrder: 3 },
  { key: 'myhrms.my_team', label: 'My Team', type: 'SECTION', parentKey: 'myhrms', sortOrder: 4 },
  { key: 'myhrms.ask_md_approval', label: 'Ask MD Approval', type: 'SECTION', parentKey: 'myhrms', sortOrder: 5 },

  // Under sales
  { key: 'sales.sales_dashboard', label: 'Sales Dashboard', type: 'SECTION', parentKey: 'sales', sortOrder: 1 },
  { key: 'sales.md_sales_dashboard', label: 'MD Sales Dashboard', type: 'SECTION', parentKey: 'sales', sortOrder: 2 },
  { key: 'sales.dm_dashboard', label: 'DM Dashboard', type: 'SECTION', parentKey: 'sales', sortOrder: 3 },
  { key: 'sales.case_tracker', label: 'Case Tracker', type: 'SECTION', parentKey: 'sales', sortOrder: 4 },
  { key: 'sales.pending_surgery', label: 'Pending Surgery', type: 'SECTION', parentKey: 'sales', sortOrder: 5 },
  { key: 'sales.targets', label: 'Targets', type: 'SECTION', parentKey: 'sales', sortOrder: 6 },
  { key: 'sales.team_lead_targets', label: 'Team Lead Targets', type: 'SECTION', parentKey: 'sales', sortOrder: 7 },
  { key: 'sales.sales_head_targets', label: 'Sales Head Targets', type: 'SECTION', parentKey: 'sales', sortOrder: 8 },
  { key: 'sales.sales_pnl', label: 'Sales P&L', type: 'SECTION', parentKey: 'sales', sortOrder: 9 },
  { key: 'sales.campaign_cpl', label: 'Campaign CPL', type: 'SECTION', parentKey: 'sales', sortOrder: 10 },
  { key: 'sales.sales_pipeline', label: 'Sales Pipeline', type: 'SECTION', parentKey: 'sales', sortOrder: 11 },
  { key: 'sales.team_lead_pipeline', label: 'Team Lead Pipeline', type: 'SECTION', parentKey: 'sales', sortOrder: 12 },
  { key: 'sales.ea_pipeline', label: 'EA Pipeline', type: 'SECTION', parentKey: 'sales', sortOrder: 13 },
  { key: 'sales.blueprint_dashboard', label: 'Blue Print Dashboard', type: 'SECTION', parentKey: 'sales', sortOrder: 14 },


  // Under insurance_pl
  { key: 'insurance_pl.insurance', label: 'Insurance', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 1 },
  { key: 'insurance_pl.cash_cases', label: 'Cash Cases', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 2 },
  { key: 'insurance_pl.pl_ledger', label: 'P/L Ledger', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 3 },
  { key: 'insurance_pl.pl_surgery', label: 'P/L Surgery', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 4 },
  { key: 'insurance_pl.pl_outstanding', label: 'P/L Outstanding', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 5 },
  { key: 'insurance_pl.doctor_list', label: 'Doctor List', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 6 },
  { key: 'insurance_pl.hospital_list', label: 'Hospital List', type: 'SECTION', parentKey: 'insurance_pl', sortOrder: 7 },

  // Under finance
  { key: 'finance.fin_payroll', label: 'Fin Payroll', type: 'SECTION', parentKey: 'finance', sortOrder: 1 },
  { key: 'finance.fin_ledger', label: 'Fin Ledger', type: 'SECTION', parentKey: 'finance', sortOrder: 2 },
  { key: 'finance.fin_new_ledger_entry', label: 'Fin New Ledger Entry', type: 'SECTION', parentKey: 'finance', sortOrder: 3 },
  { key: 'finance.fin_sales', label: 'Fin Sales', type: 'SECTION', parentKey: 'finance', sortOrder: 4 },
  { key: 'finance.fin_parties', label: 'Fin Parties', type: 'SECTION', parentKey: 'finance', sortOrder: 5 },
  { key: 'finance.fin_heads', label: 'Fin Heads', type: 'SECTION', parentKey: 'finance', sortOrder: 6 },
  { key: 'finance.fin_projects', label: 'Fin Projects', type: 'SECTION', parentKey: 'finance', sortOrder: 7 },
  { key: 'finance.fin_payment_modes', label: 'Fin Payment Modes', type: 'SECTION', parentKey: 'finance', sortOrder: 8 },
  { key: 'finance.fin_inventory', label: 'Fin Inventory', type: 'SECTION', parentKey: 'finance', sortOrder: 9 },
  { key: 'finance.fin_approvals', label: 'Fin Approvals', type: 'SECTION', parentKey: 'finance', sortOrder: 10 },
  { key: 'finance.fin_team_approvals', label: 'Fin Team Approvals', type: 'SECTION', parentKey: 'finance', sortOrder: 11 },
  { key: 'finance.md_team_approvals', label: 'MD Team Approvals', type: 'SECTION', parentKey: 'finance', sortOrder: 12 },
  { key: 'finance.fin_reports', label: 'Fin Reports', type: 'SECTION', parentKey: 'finance', sortOrder: 13 },
  { key: 'finance.fin_invoice_requests', label: 'Fin Invoice Requests', type: 'SECTION', parentKey: 'finance', sortOrder: 14 },
  { key: 'finance.fin_doctor_payoff', label: 'Fin Doctor Payoff', type: 'SECTION', parentKey: 'finance', sortOrder: 15 },
  { key: 'finance.fin_sales_team_cost', label: 'Sales Team Cost', type: 'SECTION', parentKey: 'finance', sortOrder: 16 },
  { key: 'finance.master_seating_cost', label: 'Master Seating Cost', type: 'SECTION', parentKey: 'finance', sortOrder: 17 },

  // Under crm
  { key: 'crm.campaigns', label: 'CRM Campaigns', type: 'SECTION', parentKey: 'crm', sortOrder: 1 },
  { key: 'crm.incoming_leads', label: 'CRM Incoming Leads', type: 'SECTION', parentKey: 'crm', sortOrder: 2 },
  { key: 'crm.kpis', label: 'CRM KPIs', type: 'SECTION', parentKey: 'crm', sortOrder: 3 },
  { key: 'crm.activity', label: 'CRM Activity', type: 'SECTION', parentKey: 'crm', sortOrder: 4 },
  { key: 'crm.masters', label: 'CRM Masters', type: 'SECTION', parentKey: 'crm', sortOrder: 5 },
  { key: 'crm.access_matrix', label: 'CRM Access Matrix', type: 'SECTION', parentKey: 'crm', sortOrder: 6 },
  { key: 'crm.churn_rules', label: 'CRM Churn Rules', type: 'SECTION', parentKey: 'crm', sortOrder: 7 },

  // ENTITIES (Legacy Leaf Actions & static mapping)
  { key: 'leads.table.lead.column.phoneNumber', label: 'Phone Number Column', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 1 },
  { key: 'leads.table.lead.column.surgeryAmount', label: 'Surgery Amount Column', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 2 },
  { key: 'leads.actions.create_meet', label: 'Create Meet Action', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 3 },
  { key: 'actions.md_approval_request', label: 'Ask MD Approval', type: 'ENTITY', parentKey: 'actions', sortOrder: 1 },
  { key: 'actions.create_notice', label: 'Create Notice', type: 'ENTITY', parentKey: 'actions', sortOrder: 2 },
  { key: 'actions.worklog_enforcement', label: 'Worklog Enforcement', type: 'ENTITY', parentKey: 'actions', sortOrder: 3 },
  { key: 'actions.create_meet', label: 'Create Meet', type: 'ENTITY', parentKey: 'actions', sortOrder: 4 },
  { key: 'actions.cpl_access', label: 'Campaign CPL Access', type: 'ENTITY', parentKey: 'actions', sortOrder: 5 },

  // Unified Database Column Registry Map
  { key: 'sales.case_tracker.table.lead.column.phoneNumber', label: 'Patient Phone Number', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 10 },
  { key: 'sales.case_tracker.table.lead.column.alternateNumber', label: 'Alternate Phone Number', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 11 },
  { key: 'sales.case_tracker.table.lead.column.patientEmail', label: 'Patient Email Address', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 12 },
  { key: 'sales.case_tracker.table.lead.column.netProfit', label: 'Net Profit Amount', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 13 },

  // Blueprint Dashboard Table Column Registry Map
  { key: 'sales.blueprint_dashboard.table.blueprint.column.name', label: 'Blueprint Column: Name', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 20 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.team', label: 'Blueprint Column: Team', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 21 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.teamSize', label: 'Blueprint Column: Team Size', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 22 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.targetSalaryMin', label: 'Blueprint Column: Target (Salary Min)', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 23 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.target', label: 'Blueprint Column: Target', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 24 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.costTotalSpend', label: 'Blueprint Column: Cost Total Spend', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 25 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.netProfitActual', label: 'Blueprint Column: Net Profit Actual', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 26 },
  { key: 'sales.blueprint_dashboard.table.blueprint.column.mediendProfit', label: 'Blueprint Column: MediEnd Profit', type: 'ENTITY', parentKey: 'sales.blueprint_dashboard', sortOrder: 27 },

  // ============================================
  // NESTED LEVEL 3/4 MATRIX EXTENSIONS (ALL TABLES)
  // ============================================

  // --- MODULE 1: MAIN NAVIGATION ---
  
  // Tasks (main.tasks)
  { key: 'main.tasks.overview', label: 'Overview Tab', type: 'SECTION', parentKey: 'main.tasks', sortOrder: 1 },
  { key: 'main.tasks.my_tasks', label: 'My Tasks Tab', type: 'SECTION', parentKey: 'main.tasks', sortOrder: 2 },

  // Calendar (main.calendar)
  { key: 'main.calendar.analytics', label: 'Analytics Section', type: 'SECTION', parentKey: 'main.calendar', sortOrder: 1 },
  { key: 'main.calendar.calendar', label: 'Calendar Section', type: 'SECTION', parentKey: 'main.calendar', sortOrder: 2 },

  // Meets (main.meets)
  { key: 'main.meets.upcoming', label: 'Upcoming Tab', type: 'SECTION', parentKey: 'main.meets', sortOrder: 1 },
  { key: 'main.meets.history', label: 'History Tab', type: 'SECTION', parentKey: 'main.meets', sortOrder: 2 },

  // Finance Dashboard (main.finance_dashboard)
  { key: 'main.finance_dashboard.analytics', label: 'Finance Run Rate Analytics', type: 'SECTION', parentKey: 'main.finance_dashboard', sortOrder: 1 },
  { key: 'main.finance_dashboard.analytics.revenue_run_rate', label: 'Revenue Run Rate Card', type: 'ENTITY', parentKey: 'main.finance_dashboard.analytics', sortOrder: 1 },
  { key: 'main.finance_dashboard.analytics.operating_margin', label: 'Operating Margin Card', type: 'ENTITY', parentKey: 'main.finance_dashboard.analytics', sortOrder: 2 },
  { key: 'main.finance_dashboard.analytics.cash_flow', label: 'Cash Flow Card', type: 'ENTITY', parentKey: 'main.finance_dashboard.analytics', sortOrder: 3 },

  // IT Permissions (main.it_permissions)
  { key: 'main.it_permissions.table', label: 'User Directory Access Table', type: 'SECTION', parentKey: 'main.it_permissions', sortOrder: 1 },
  { key: 'main.it_permissions.table.user.column.profile', label: 'User Profile Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 1 },
  { key: 'main.it_permissions.table.user.column.role', label: 'Role Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 2 },
  { key: 'main.it_permissions.table.user.column.department', label: 'Department Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 3 },
  { key: 'main.it_permissions.table.user.column.action', label: 'Manage Button Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 4 },

  // IT P&L (main.it_pnl)
  { key: 'main.it_pnl.overview', label: 'Overview Tab', type: 'SECTION', parentKey: 'main.it_pnl', sortOrder: 1 },
  { key: 'main.it_pnl.projects', label: 'Projects Tab', type: 'SECTION', parentKey: 'main.it_pnl', sortOrder: 2 },
  { key: 'main.it_pnl.resources', label: 'Resources Tab', type: 'SECTION', parentKey: 'main.it_pnl', sortOrder: 3 },

  // Incentive (main.incentive)
  { key: 'main.incentive.analytics', label: 'Incentive Analytics Section', type: 'SECTION', parentKey: 'main.incentive', sortOrder: 1 },
  { key: 'main.incentive.table', label: 'Incentive Table Section', type: 'SECTION', parentKey: 'main.incentive', sortOrder: 2 },
  { key: 'main.incentive.table.incentive.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 1 },
  { key: 'main.incentive.table.incentive.column.employee_id', label: 'Employee ID Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 2 },
  { key: 'main.incentive.table.incentive.column.department', label: 'Department Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 3 },
  { key: 'main.incentive.table.incentive.column.designation', label: 'Designation Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 4 },
  { key: 'main.incentive.table.incentive.column.month', label: 'Month Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 5 },
  { key: 'main.incentive.table.incentive.column.incentive_amount', label: 'Incentive Amount Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 6 },
  { key: 'main.incentive.table.incentive.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 7 },
  { key: 'main.incentive.table.incentive.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'main.incentive.table', sortOrder: 8 },

  // --- MODULE 2: HUMAN RESOURCE MANAGEMENT ---
  
  // Attendance & Leaves (hrm.attendance_normalizations)
  { key: 'hrm.attendance_normalizations.table', label: 'Attendance & Normalization Table', type: 'SECTION', parentKey: 'hrm.attendance_normalizations', sortOrder: 1 },
  { key: 'hrm.attendance_normalizations.table.attendance.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 1 },
  { key: 'hrm.attendance_normalizations.table.attendance.column.in_time', label: 'In Time Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 2 },
  { key: 'hrm.attendance_normalizations.table.attendance.column.out_time', label: 'Out Time Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 3 },
  { key: 'hrm.attendance_normalizations.table.attendance.column.normalization_status', label: 'Normalization Status Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 4 },

  // People & Org (hrm.people_org)
  { key: 'hrm.people_org.table', label: 'People & Org Table', type: 'SECTION', parentKey: 'hrm.people_org', sortOrder: 1 },
  { key: 'hrm.people_org.table.employee.column.name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 1 },
  { key: 'hrm.people_org.table.employee.column.designation', label: 'Designation Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 2 },
  { key: 'hrm.people_org.table.employee.column.doj', label: 'Date of Joining Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 3 },
  { key: 'hrm.people_org.table.employee.column.branch', label: 'Branch Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 4 },
  { key: 'hrm.people_org.table.employee.column.reports_to', label: 'Reports To Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 5 },

  // Compensation & Docs (hrm.compensation_docs)
  { key: 'hrm.compensation_docs.table', label: 'Compensation Documents Table', type: 'SECTION', parentKey: 'hrm.compensation_docs', sortOrder: 1 },
  { key: 'hrm.compensation_docs.table.compensation.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'hrm.compensation_docs.table', sortOrder: 1 },
  { key: 'hrm.compensation_docs.table.compensation.column.ctc', label: 'CTC Details Column', type: 'ENTITY', parentKey: 'hrm.compensation_docs.table', sortOrder: 2 },
  { key: 'hrm.compensation_docs.table.compensation.column.structure', label: 'Salary Structure Column', type: 'ENTITY', parentKey: 'hrm.compensation_docs.table', sortOrder: 3 },

  // Employee Engagement (hrm.engagement)
  { key: 'hrm.engagement.analytics', label: 'Employee Engagement Analytics', type: 'SECTION', parentKey: 'hrm.engagement', sortOrder: 1 },
  { key: 'hrm.engagement.analytics.score', label: 'Engagement Score Card', type: 'ENTITY', parentKey: 'hrm.engagement.analytics', sortOrder: 1 },
  { key: 'hrm.engagement.analytics.nps', label: 'Employee NPS Card', type: 'ENTITY', parentKey: 'hrm.engagement.analytics', sortOrder: 2 },
  { key: 'hrm.engagement.analytics.retention', label: 'Retention Rate Card', type: 'ENTITY', parentKey: 'hrm.engagement.analytics', sortOrder: 3 },

  // Recruitment (hrm.recruitment)
  { key: 'hrm.recruitment.table', label: 'Recruitment Pipeline Table', type: 'SECTION', parentKey: 'hrm.recruitment', sortOrder: 1 },
  { key: 'hrm.recruitment.table.jobPosting.column.job_code', label: 'Job Code Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 1 },
  { key: 'hrm.recruitment.table.jobPosting.column.title', label: 'Job Title Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 2 },
  { key: 'hrm.recruitment.table.jobPosting.column.openings', label: 'Openings Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 3 },
  { key: 'hrm.recruitment.table.jobPosting.column.candidates', label: 'Applied Candidates Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 4 },

  // --- MODULE 3: MY HRMS PORTAL ---
  
  // My Core HR (myhrms.my_core_hr)
  { key: 'myhrms.my_core_hr.attendance', label: 'Attendance Tab', type: 'SECTION', parentKey: 'myhrms.my_core_hr', sortOrder: 1 },
  { key: 'myhrms.my_core_hr.leaves', label: 'Leaves Tab', type: 'SECTION', parentKey: 'myhrms.my_core_hr', sortOrder: 2 },
  { key: 'myhrms.my_core_hr.holidays', label: 'Holidays Tab', type: 'SECTION', parentKey: 'myhrms.my_core_hr', sortOrder: 3 },
  { key: 'myhrms.my_core_hr.documents', label: 'Documents Tab', type: 'SECTION', parentKey: 'myhrms.my_core_hr', sortOrder: 4 },
  { key: 'myhrms.my_core_hr.hr_policies', label: 'HR Policies Tab', type: 'SECTION', parentKey: 'myhrms.my_core_hr', sortOrder: 5 },

  // My Financial (myhrms.my_financial)
  { key: 'myhrms.my_financial.payroll', label: 'Payroll Tab', type: 'SECTION', parentKey: 'myhrms.my_financial', sortOrder: 1 },
  { key: 'myhrms.my_financial.increment', label: 'Increment Tab', type: 'SECTION', parentKey: 'myhrms.my_financial', sortOrder: 2 },

  // My Support Services (myhrms.my_support_services)
  { key: 'myhrms.my_support_services.feedback', label: 'Feedback Tab', type: 'SECTION', parentKey: 'myhrms.my_support_services', sortOrder: 1 },
  { key: 'myhrms.my_support_services.ticket', label: 'Ticket Tab', type: 'SECTION', parentKey: 'myhrms.my_support_services', sortOrder: 2 },
  { key: 'myhrms.my_support_services.mdconnect', label: 'MDConnect Tab', type: 'SECTION', parentKey: 'myhrms.my_support_services', sortOrder: 3 },
  { key: 'myhrms.my_support_services.mental_health', label: 'Mental Health Tab', type: 'SECTION', parentKey: 'myhrms.my_support_services', sortOrder: 4 },
  { key: 'myhrms.my_support_services.job_postings', label: 'Job Postings Tab', type: 'SECTION', parentKey: 'myhrms.my_support_services', sortOrder: 5 },

  // My Team (myhrms.my_team)
  { key: 'myhrms.my_team.attendance_leave', label: 'Attendance & Leave Tab', type: 'SECTION', parentKey: 'myhrms.my_team', sortOrder: 1 },
  { key: 'myhrms.my_team.loans', label: 'Loans Tab', type: 'SECTION', parentKey: 'myhrms.my_team', sortOrder: 2 },
  { key: 'myhrms.my_team.normalization', label: 'Normalization Tab', type: 'SECTION', parentKey: 'myhrms.my_team', sortOrder: 3 },

  // Ask MD Approval (myhrms.ask_md_approval)
  { key: 'myhrms.ask_md_approval.pending', label: 'Pending Tab', type: 'SECTION', parentKey: 'myhrms.ask_md_approval', sortOrder: 1 },
  { key: 'myhrms.ask_md_approval.history', label: 'History Tab', type: 'SECTION', parentKey: 'myhrms.ask_md_approval', sortOrder: 2 },

  // --- MODULE 4: SALES & MARKETING ---
  { key: 'sales.case_tracker.analytics', label: 'Case Tracker Analytics', type: 'SECTION', parentKey: 'sales.case_tracker', sortOrder: 1 },
  { key: 'sales.case_tracker.analytics.total_leads', label: 'Total Leads Card', type: 'ENTITY', parentKey: 'sales.case_tracker.analytics', sortOrder: 1 },
  { key: 'sales.case_tracker.analytics.active_leads', label: 'Active Leads Card', type: 'ENTITY', parentKey: 'sales.case_tracker.analytics', sortOrder: 2 },
  { key: 'sales.case_tracker.analytics.converted_leads', label: 'Converted Leads Card', type: 'ENTITY', parentKey: 'sales.case_tracker.analytics', sortOrder: 3 },
  
  { key: 'sales.case_tracker.table', label: 'Case Tracker Table', type: 'SECTION', parentKey: 'sales.case_tracker', sortOrder: 2 },
  { key: 'sales.case_tracker.table.lead.column.lead_ref', label: 'Lead Ref Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 1 },
  { key: 'sales.case_tracker.table.lead.column.date', label: 'Date Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 2 },
  { key: 'sales.case_tracker.table.lead.column.surgery_date', label: 'Surgery Date Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 3 },
  { key: 'sales.case_tracker.table.lead.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 4 },
  { key: 'sales.case_tracker.table.lead.column.age_sex', label: 'Age/Sex Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 5 },
  { key: 'sales.case_tracker.table.lead.column.circle', label: 'Circle Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 6 },
  { key: 'sales.case_tracker.table.lead.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 7 },
  { key: 'sales.case_tracker.table.lead.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 8 },
  { key: 'sales.case_tracker.table.lead.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 9 },
  { key: 'sales.case_tracker.table.lead.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 10 },
  { key: 'sales.case_tracker.table.lead.column.stage', label: 'Stage Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 11 },
  { key: 'sales.case_tracker.table.lead.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 12 },

  { key: 'sales.sales_pipeline.table', label: 'Sales Pipeline Table', type: 'SECTION', parentKey: 'sales.sales_pipeline', sortOrder: 2 },
  { key: 'sales.sales_pipeline.table.lead.column.lead_ref', label: 'Lead Ref Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 1 },
  { key: 'sales.sales_pipeline.table.lead.column.date', label: 'Date Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 2 },
  { key: 'sales.sales_pipeline.table.lead.column.surgery_date', label: 'Surgery Date Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 3 },
  { key: 'sales.sales_pipeline.table.lead.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 4 },
  { key: 'sales.sales_pipeline.table.lead.column.age_sex', label: 'Age/Sex Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 5 },
  { key: 'sales.sales_pipeline.table.lead.column.circle', label: 'Circle Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 6 },
  { key: 'sales.sales_pipeline.table.lead.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 7 },
  { key: 'sales.sales_pipeline.table.lead.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 8 },
  { key: 'sales.sales_pipeline.table.lead.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 9 },
  { key: 'sales.sales_pipeline.table.lead.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 10 },
  { key: 'sales.sales_pipeline.table.lead.column.stage', label: 'Stage Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 11 },
  { key: 'sales.sales_pipeline.table.lead.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'sales.sales_pipeline.table', sortOrder: 12 },

  { key: 'sales.team_lead_pipeline.table', label: 'Team Lead Pipeline Table', type: 'SECTION', parentKey: 'sales.team_lead_pipeline', sortOrder: 2 },
  { key: 'sales.team_lead_pipeline.table.lead.column.lead_ref', label: 'Lead Ref Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 1 },
  { key: 'sales.team_lead_pipeline.table.lead.column.date', label: 'Date Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 2 },
  { key: 'sales.team_lead_pipeline.table.lead.column.surgery_date', label: 'Surgery Date Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 3 },
  { key: 'sales.team_lead_pipeline.table.lead.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 4 },
  { key: 'sales.team_lead_pipeline.table.lead.column.age_sex', label: 'Age/Sex Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 5 },
  { key: 'sales.team_lead_pipeline.table.lead.column.circle', label: 'Circle Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 6 },
  { key: 'sales.team_lead_pipeline.table.lead.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 7 },
  { key: 'sales.team_lead_pipeline.table.lead.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 8 },
  { key: 'sales.team_lead_pipeline.table.lead.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 9 },
  { key: 'sales.team_lead_pipeline.table.lead.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 10 },
  { key: 'sales.team_lead_pipeline.table.lead.column.stage', label: 'Stage Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 11 },
  { key: 'sales.team_lead_pipeline.table.lead.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'sales.team_lead_pipeline.table', sortOrder: 12 },

  // --- MODULE 5: INSURANCE & P/L ---
  { key: 'insurance_pl.pl_surgery.analytics', label: 'PL Surgery Analytics Section', type: 'SECTION', parentKey: 'insurance_pl.pl_surgery', sortOrder: 1 },
  { key: 'insurance_pl.pl_surgery.analytics.total_surgeries_card', label: 'Total Surgeries Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.analytics', sortOrder: 1 },
  { key: 'insurance_pl.pl_surgery.analytics.revenue_card', label: 'Revenue Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.analytics', sortOrder: 2 },
  { key: 'insurance_pl.pl_surgery.analytics.avg_margin_card', label: 'Average Margin Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.analytics', sortOrder: 3 },

  { key: 'insurance_pl.pl_surgery.table', label: 'PL Surgery Table Section', type: 'SECTION', parentKey: 'insurance_pl.pl_surgery', sortOrder: 2 },
  { key: 'insurance_pl.pl_surgery.table.dischargeSheet.column.bd', label: 'BD Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 1 },
  { key: 'insurance_pl.pl_surgery.table.dischargeSheet.column.team_leader', label: 'Team Leader Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 2 },
  { key: 'insurance_pl.pl_surgery.table.dischargeSheet.column.surgeries', label: 'Surgeries Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 3 },
  { key: 'insurance_pl.pl_surgery.table.dischargeSheet.column.revenue', label: 'Revenue Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 4 },
  { key: 'insurance_pl.pl_surgery.table.dischargeSheet.column.expenses', label: 'Expenses Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 5 },
  { key: 'insurance_pl.pl_surgery.table.dischargeSheet.column.net_profit', label: 'Net Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 6 },

  { key: 'insurance_pl.insurance.analytics', label: 'Insurance Analytics Section', type: 'SECTION', parentKey: 'insurance_pl.insurance', sortOrder: 1 },
  { key: 'insurance_pl.insurance.analytics.active_claims', label: 'Active Claims Card', type: 'ENTITY', parentKey: 'insurance_pl.insurance.analytics', sortOrder: 1 },
  { key: 'insurance_pl.insurance.analytics.settlement_ratio', label: 'Settlement Ratio Card', type: 'ENTITY', parentKey: 'insurance_pl.insurance.analytics', sortOrder: 2 },

  { key: 'insurance_pl.insurance.table', label: 'Insurance Claims Table', type: 'SECTION', parentKey: 'insurance_pl.insurance', sortOrder: 2 },
  { key: 'insurance_pl.insurance.table.lead.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 1 },
  { key: 'insurance_pl.insurance.table.lead.column.tpa', label: 'TPA Provider Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 2 },
  { key: 'insurance_pl.insurance.table.lead.column.claim_status', label: 'Claim Status Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 3 },
  { key: 'insurance_pl.insurance.table.lead.column.approved_amount', label: 'Approved Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 4 },

  { key: 'insurance_pl.cash_cases.table', label: 'Cash Cases Table Section', type: 'SECTION', parentKey: 'insurance_pl.cash_cases', sortOrder: 1 },
  { key: 'insurance_pl.cash_cases.table.lead.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'insurance_pl.cash_cases.table', sortOrder: 1 },
  { key: 'insurance_pl.cash_cases.table.lead.column.cash_amount', label: 'Cash Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.cash_cases.table', sortOrder: 2 },
  { key: 'insurance_pl.cash_cases.table.lead.column.received_status', label: 'Received Status Column', type: 'ENTITY', parentKey: 'insurance_pl.cash_cases.table', sortOrder: 3 },

  { key: 'insurance_pl.pl_ledger.analytics', label: 'PL Ledger Analytics', type: 'SECTION', parentKey: 'insurance_pl.pl_ledger', sortOrder: 1 },
  { key: 'insurance_pl.pl_ledger.analytics.total_revenue', label: 'Total Revenue Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.analytics', sortOrder: 1 },
  { key: 'insurance_pl.pl_ledger.analytics.total_margin', label: 'Total Margin Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.analytics', sortOrder: 2 },

  { key: 'insurance_pl.pl_ledger.table', label: 'PL Ledger Table Section', type: 'SECTION', parentKey: 'insurance_pl.pl_ledger', sortOrder: 2 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 1 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.month', label: 'Month Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 2 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.lead_received', label: 'Lead Received Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 3 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.manager', label: 'Manager Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 4 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 5 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.patient', label: 'Patient Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 6 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.category', label: 'Category Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 7 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 8 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.circle', label: 'Circle Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 9 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 10 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 11 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.admission_date', label: 'Admission Date Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 12 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.surgery_date', label: 'Surgery Date Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 13 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.payment_type', label: 'Payment Type Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 14 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.outstanding_status', label: 'PL Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 15 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 16 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.total_bill', label: 'Total Bill Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 17 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.approved_amount', label: 'Approved Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 18 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.deduction_total', label: 'Total Deduction Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 19 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.deduction_patient', label: 'Deduction Patient Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 20 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.deduction_waived', label: 'Deduction Waived Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 21 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.amount_paid', label: 'Amount Paid Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 22 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.hospital_share_pct', label: 'Hospital Share % Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 23 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.hospital_share_amt', label: 'Hospital Share Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 24 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.doctor_charges', label: 'Doctor Charges Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 25 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.implant', label: 'Implant Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 26 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.implant_paid_by', label: 'Implant Paid By Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 27 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.instruments', label: 'Instruments Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 28 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.instruments_paid_by', label: 'Instruments Paid By Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 29 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.actual_implant_cost', label: 'Actual Implant Cost Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 30 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.actual_instrument_cost', label: 'Actual Instrument Cost Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 31 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.hospital_recover_amount', label: 'Hospital Recover Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 32 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.dc', label: 'D&C Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 33 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.cab', label: 'Cab Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 34 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.referral', label: 'Referral Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 35 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.mediend_share_pct', label: 'MediEND Share % Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 36 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.mediend_share_amt', label: 'MediEND Share Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 37 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.net_profit', label: 'Net Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 38 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.mediend_profit', label: 'MediEND Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 39 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.remarks', label: 'Remarks Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 40 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.hosp_payout', label: 'Hospital Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 41 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.doc_payout', label: 'Doctor Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 42 },
  { key: 'insurance_pl.pl_ledger.table.dischargeSheet.column.invoice', label: 'Invoice Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 43 },

  { key: 'insurance_pl.pl_outstanding.analytics', label: 'PL Outstanding Analytics', type: 'SECTION', parentKey: 'insurance_pl.pl_outstanding', sortOrder: 1 },
  { key: 'insurance_pl.pl_outstanding.analytics.total_outstanding', label: 'Total Outstanding Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.analytics', sortOrder: 1 },
  { key: 'insurance_pl.pl_outstanding.analytics.overdue_cases', label: 'Overdue Cases Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.analytics', sortOrder: 2 },

  { key: 'insurance_pl.pl_outstanding.table', label: 'PL Outstanding Table Section', type: 'SECTION', parentKey: 'insurance_pl.pl_outstanding', sortOrder: 2 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.lead_ref', label: 'Lead Ref Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 1 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 2 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.month', label: 'Month Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 3 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.lead_received', label: 'Lead Received Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 4 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.manager', label: 'Manager Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 5 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 6 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 7 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.category', label: 'Category Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 8 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 9 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 10 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 11 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.admission', label: 'Admission Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 12 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.surgery', label: 'Surgery Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 13 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.payment', label: 'Payment Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 14 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 15 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.total_bill', label: 'Total Bill Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 16 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.approved', label: 'Approved Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 17 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.total_deduction', label: 'Total Deduction Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 18 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.deduction_paid_by_patient', label: 'Deduction Paid By Patient Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 19 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.waived_off', label: 'Waived Off Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 20 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.net_profit', label: 'Net Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 21 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.mediend_payout', label: 'MediEND Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 22 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.mediend_pending', label: 'MediEND Pending Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 23 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.doctor_payout', label: 'Doctor Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 24 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.doctor_pending', label: 'Doctor Pending Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 25 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.invoice_status', label: 'Invoice Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 26 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.payment_received', label: 'Payment Received Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 27 },
  { key: 'insurance_pl.pl_outstanding.table.dischargeSheet.column.remarks', label: 'Remarks Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 28 },

  // Doctor List (insurance_pl.doctor_list)
  { key: 'insurance_pl.doctor_list.table', label: 'Doctor List Table', type: 'SECTION', parentKey: 'insurance_pl.doctor_list', sortOrder: 1 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 1 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.cases', label: 'Cases Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 2 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.total_bill', label: 'Total Bill Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 3 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.paid', label: 'Paid Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 4 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.pending', label: 'Pending Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 5 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.doctor_share', label: 'Doctor Share Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 6 },
  { key: 'insurance_pl.doctor_list.table.doctor.column.mediend_share', label: 'MediEND Share Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 7 },

  // Hospital List (insurance_pl.hospital_list)
  { key: 'insurance_pl.hospital_list.table', label: 'Hospital List Table', type: 'SECTION', parentKey: 'insurance_pl.hospital_list', sortOrder: 1 },
  { key: 'insurance_pl.hospital_list.table.hospital.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 1 },
  { key: 'insurance_pl.hospital_list.table.hospital.column.cases', label: 'Cases Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 2 },
  { key: 'insurance_pl.hospital_list.table.hospital.column.amount_received', label: 'Amount Received Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 3 },
  { key: 'insurance_pl.hospital_list.table.hospital.column.pending_outstanding', label: 'Pending Outstanding Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 4 },
  { key: 'insurance_pl.hospital_list.table.hospital.column.mediend_share', label: 'MediEND Share Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 5 },

  // --- MODULE 6: FINANCE & ACCOUNTS ---
  { key: 'finance.fin_payroll.table', label: 'Finance Payroll Table', type: 'SECTION', parentKey: 'finance.fin_payroll', sortOrder: 1 },
  { key: 'finance.fin_payroll.table.payroll.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 1 },
  { key: 'finance.fin_payroll.table.payroll.column.basic_salary', label: 'Basic Salary Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 2 },
  { key: 'finance.fin_payroll.table.payroll.column.allowances', label: 'Allowances Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 3 },
  { key: 'finance.fin_payroll.table.payroll.column.deductions', label: 'Deductions Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 4 },
  { key: 'finance.fin_payroll.table.payroll.column.net_payable', label: 'Net Payable Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 5 },

  { key: 'finance.fin_ledger.table', label: 'General Ledger Table', type: 'SECTION', parentKey: 'finance.fin_ledger', sortOrder: 1 },
  { key: 'finance.fin_ledger.table.ledger.column.transaction_id', label: 'Transaction ID Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 1 },
  { key: 'finance.fin_ledger.table.ledger.column.description', label: 'Description Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 2 },
  { key: 'finance.fin_ledger.table.ledger.column.amount', label: 'Amount Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 3 },
  { key: 'finance.fin_ledger.table.ledger.column.mode', label: 'Payment Mode Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 4 },
  { key: 'finance.fin_ledger.table.ledger.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 5 },
]

async function main() {
  console.log('Cleaning obsolete resources and assignments...')
  const seededKeys = resourcesToSeed.map((r) => r.key)
  const obsoleteResources = await prisma.resource.findMany({
    where: { NOT: { key: { in: seededKeys } } },
    select: { id: true, key: true }
  })
  
  if (obsoleteResources.length > 0) {
    const obsoleteIds = obsoleteResources.map((r) => r.id)
    
    // 1. Delete assignments for obsolete resources
    await prisma.permissionAssignment.deleteMany({
      where: { resourceId: { in: obsoleteIds } }
    })
    
    // 2. Delete obsolete resources hierarchically to prevent foreign key errors
    await prisma.resource.deleteMany({
      where: { id: { in: obsoleteIds }, type: 'ENTITY' }
    })
    await prisma.resource.deleteMany({
      where: { id: { in: obsoleteIds }, type: 'SECTION' }
    })
    await prisma.resource.deleteMany({
      where: { id: { in: obsoleteIds }, type: 'MODULE' }
    })
    console.log(`Deleted ${obsoleteResources.length} obsolete resources and their assignments.`)
  }

  console.log('Seeding resources...')

  // Step 1: Upsert Modules first (to ensure parents exist)
  const modules = resourcesToSeed.filter((r) => r.type === 'MODULE')
  for (const item of modules) {
    await prisma.resource.upsert({
      where: { key: item.key },
      update: {
        label: item.label,
        type: item.type,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        key: item.key,
        label: item.label,
        type: item.type,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`Seeded ${modules.length} MODULE resources.`)

  // Step 2: Upsert Sections
  const sections = resourcesToSeed.filter((r) => r.type === 'SECTION')
  for (const item of sections) {
    const parent = await prisma.resource.findUnique({
      where: { key: item.parentKey! },
    })
    if (!parent) {
      console.error(`Parent resource ${item.parentKey} not found for ${item.key}`)
      continue
    }
    await prisma.resource.upsert({
      where: { key: item.key },
      update: {
        label: item.label,
        type: item.type,
        parentId: parent.id,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        key: item.key,
        label: item.label,
        type: item.type,
        parentId: parent.id,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`Seeded ${sections.length} SECTION resources.`)

  // Step 3: Upsert Entities
  const entities = resourcesToSeed.filter((r) => r.type === 'ENTITY')
  for (const item of entities) {
    const parent = await prisma.resource.findUnique({
      where: { key: item.parentKey! },
    })
    if (!parent) {
      console.error(`Parent resource ${item.parentKey} not found for ${item.key}`)
      continue
    }
    await prisma.resource.upsert({
      where: { key: item.key },
      update: {
        label: item.label,
        type: item.type,
        parentId: parent.id,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        key: item.key,
        label: item.label,
        type: item.type,
        parentId: parent.id,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    })
  }
  console.log(`Seeded ${entities.length} ENTITY resources.`)

  console.log('Resource seeding completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
