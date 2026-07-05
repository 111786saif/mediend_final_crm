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

  // Under hrm
  { key: 'hrm.attendance_normalizations', label: 'Attendance & Normalizations', type: 'SECTION', parentKey: 'hrm', sortOrder: 1 },
  { key: 'hrm.people_org', label: 'People & Org', type: 'SECTION', parentKey: 'hrm', sortOrder: 2 },
  { key: 'hrm.compensation_docs', label: 'Compensation & Docs', type: 'SECTION', parentKey: 'hrm', sortOrder: 3 },
  { key: 'hrm.engagement', label: 'Engagement', type: 'SECTION', parentKey: 'hrm', sortOrder: 4 },
  { key: 'hrm.recruitment', label: 'Recruitment', type: 'SECTION', parentKey: 'hrm', sortOrder: 5 },

  // Under myhrms
  { key: 'myhrms.my_core_hr', label: 'My Core HR', type: 'SECTION', parentKey: 'myhrms', sortOrder: 1 },
  { key: 'myhrms.my_financial', label: 'My Financial', type: 'SECTION', parentKey: 'myhrms', sortOrder: 2 },
  { key: 'myhrms.my_support_services', label: 'My Support & Services', type: 'SECTION', parentKey: 'myhrms', sortOrder: 3 },
  { key: 'myhrms.my_team', label: 'My Team', type: 'SECTION', parentKey: 'myhrms', sortOrder: 4 },
  { key: 'myhrms.ask_md_approval', label: 'Ask MD Approval', type: 'SECTION', parentKey: 'myhrms', sortOrder: 5 },

  // Under sales
  { key: 'sales.sales_dashboard', label: 'Sales Dashboard', type: 'SECTION', parentKey: 'sales', sortOrder: 1 },
  { key: 'sales.dm_dashboard', label: 'DM Dashboard', type: 'SECTION', parentKey: 'sales', sortOrder: 2 },
  { key: 'sales.case_tracker', label: 'Case Tracker', type: 'SECTION', parentKey: 'sales', sortOrder: 3 },
  { key: 'sales.pending_surgery', label: 'Pending Surgery', type: 'SECTION', parentKey: 'sales', sortOrder: 4 },
  { key: 'sales.targets', label: 'Targets', type: 'SECTION', parentKey: 'sales', sortOrder: 5 },
  { key: 'sales.sales_pnl', label: 'Sales P&L', type: 'SECTION', parentKey: 'sales', sortOrder: 6 },
  { key: 'sales.campaign_cpl', label: 'Campaign CPL', type: 'SECTION', parentKey: 'sales', sortOrder: 7 },

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

  // ENTITIES (Legacy Leaf Actions & static mapping)
  { key: 'leads.table.column.phone_number', label: 'Phone Number Column', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 1 },
  { key: 'leads.table.column.surgery_amount', label: 'Surgery Amount Column', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 2 },
  { key: 'leads.actions.create_meet', label: 'Create Meet Action', type: 'ENTITY', parentKey: 'sales.case_tracker', sortOrder: 3 },
  { key: 'actions.md_approval_request', label: 'Ask MD Approval', type: 'ENTITY', parentKey: 'actions', sortOrder: 1 },
  { key: 'actions.create_notice', label: 'Create Notice', type: 'ENTITY', parentKey: 'actions', sortOrder: 2 },
  { key: 'actions.worklog_enforcement', label: 'Worklog Enforcement', type: 'ENTITY', parentKey: 'actions', sortOrder: 3 },
  { key: 'actions.create_meet', label: 'Create Meet', type: 'ENTITY', parentKey: 'actions', sortOrder: 4 },
  { key: 'actions.cpl_access', label: 'Campaign CPL Access', type: 'ENTITY', parentKey: 'actions', sortOrder: 5 },

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
  { key: 'main.it_permissions.table.column.profile', label: 'User Profile Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 1 },
  { key: 'main.it_permissions.table.column.role', label: 'Role Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 2 },
  { key: 'main.it_permissions.table.column.department', label: 'Department Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 3 },
  { key: 'main.it_permissions.table.column.action', label: 'Manage Button Column', type: 'ENTITY', parentKey: 'main.it_permissions.table', sortOrder: 4 },

  // IT P&L (main.it_pnl)
  { key: 'main.it_pnl.overview', label: 'Overview Tab', type: 'SECTION', parentKey: 'main.it_pnl', sortOrder: 1 },
  { key: 'main.it_pnl.projects', label: 'Projects Tab', type: 'SECTION', parentKey: 'main.it_pnl', sortOrder: 2 },
  { key: 'main.it_pnl.resources', label: 'Resources Tab', type: 'SECTION', parentKey: 'main.it_pnl', sortOrder: 3 },

  // --- MODULE 2: HUMAN RESOURCE MANAGEMENT ---
  
  // Attendance & Leaves (hrm.attendance_normalizations)
  { key: 'hrm.attendance_normalizations.table', label: 'Attendance & Normalization Table', type: 'SECTION', parentKey: 'hrm.attendance_normalizations', sortOrder: 1 },
  { key: 'hrm.attendance_normalizations.table.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 1 },
  { key: 'hrm.attendance_normalizations.table.column.in_time', label: 'In Time Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 2 },
  { key: 'hrm.attendance_normalizations.table.column.out_time', label: 'Out Time Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 3 },
  { key: 'hrm.attendance_normalizations.table.column.normalization_status', label: 'Normalization Status Column', type: 'ENTITY', parentKey: 'hrm.attendance_normalizations.table', sortOrder: 4 },

  // People & Org (hrm.people_org)
  { key: 'hrm.people_org.table', label: 'People & Org Table', type: 'SECTION', parentKey: 'hrm.people_org', sortOrder: 1 },
  { key: 'hrm.people_org.table.column.name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 1 },
  { key: 'hrm.people_org.table.column.designation', label: 'Designation Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 2 },
  { key: 'hrm.people_org.table.column.doj', label: 'Date of Joining Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 3 },
  { key: 'hrm.people_org.table.column.branch', label: 'Branch Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 4 },
  { key: 'hrm.people_org.table.column.reports_to', label: 'Reports To Column', type: 'ENTITY', parentKey: 'hrm.people_org.table', sortOrder: 5 },

  // Compensation & Docs (hrm.compensation_docs)
  { key: 'hrm.compensation_docs.table', label: 'Compensation Documents Table', type: 'SECTION', parentKey: 'hrm.compensation_docs', sortOrder: 1 },
  { key: 'hrm.compensation_docs.table.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'hrm.compensation_docs.table', sortOrder: 1 },
  { key: 'hrm.compensation_docs.table.column.ctc', label: 'CTC Details Column', type: 'ENTITY', parentKey: 'hrm.compensation_docs.table', sortOrder: 2 },
  { key: 'hrm.compensation_docs.table.column.structure', label: 'Salary Structure Column', type: 'ENTITY', parentKey: 'hrm.compensation_docs.table', sortOrder: 3 },

  // Employee Engagement (hrm.engagement)
  { key: 'hrm.engagement.analytics', label: 'Employee Engagement Analytics', type: 'SECTION', parentKey: 'hrm.engagement', sortOrder: 1 },
  { key: 'hrm.engagement.analytics.score', label: 'Engagement Score Card', type: 'ENTITY', parentKey: 'hrm.engagement.analytics', sortOrder: 1 },
  { key: 'hrm.engagement.analytics.nps', label: 'Employee NPS Card', type: 'ENTITY', parentKey: 'hrm.engagement.analytics', sortOrder: 2 },
  { key: 'hrm.engagement.analytics.retention', label: 'Retention Rate Card', type: 'ENTITY', parentKey: 'hrm.engagement.analytics', sortOrder: 3 },

  // Recruitment (hrm.recruitment)
  { key: 'hrm.recruitment.table', label: 'Recruitment Pipeline Table', type: 'SECTION', parentKey: 'hrm.recruitment', sortOrder: 1 },
  { key: 'hrm.recruitment.table.column.job_code', label: 'Job Code Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 1 },
  { key: 'hrm.recruitment.table.column.title', label: 'Job Title Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 2 },
  { key: 'hrm.recruitment.table.column.openings', label: 'Openings Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 3 },
  { key: 'hrm.recruitment.table.column.candidates', label: 'Applied Candidates Column', type: 'ENTITY', parentKey: 'hrm.recruitment.table', sortOrder: 4 },

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
  { key: 'sales.case_tracker.table.column.lead_ref', label: 'Lead Ref Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 1 },
  { key: 'sales.case_tracker.table.column.date', label: 'Date Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 2 },
  { key: 'sales.case_tracker.table.column.surgery_date', label: 'Surgery Date Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 3 },
  { key: 'sales.case_tracker.table.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 4 },
  { key: 'sales.case_tracker.table.column.age_sex', label: 'Age/Sex Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 5 },
  { key: 'sales.case_tracker.table.column.circle', label: 'Circle Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 6 },
  { key: 'sales.case_tracker.table.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 7 },
  { key: 'sales.case_tracker.table.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 8 },
  { key: 'sales.case_tracker.table.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 9 },
  { key: 'sales.case_tracker.table.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 10 },
  { key: 'sales.case_tracker.table.column.stage', label: 'Stage Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 11 },
  { key: 'sales.case_tracker.table.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'sales.case_tracker.table', sortOrder: 12 },

  // --- MODULE 5: INSURANCE & P/L ---
  { key: 'insurance_pl.pl_surgery.analytics', label: 'PL Surgery Analytics Section', type: 'SECTION', parentKey: 'insurance_pl.pl_surgery', sortOrder: 1 },
  { key: 'insurance_pl.pl_surgery.analytics.total_surgeries_card', label: 'Total Surgeries Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.analytics', sortOrder: 1 },
  { key: 'insurance_pl.pl_surgery.analytics.revenue_card', label: 'Revenue Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.analytics', sortOrder: 2 },
  { key: 'insurance_pl.pl_surgery.analytics.avg_margin_card', label: 'Average Margin Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.analytics', sortOrder: 3 },

  { key: 'insurance_pl.pl_surgery.table', label: 'PL Surgery Table Section', type: 'SECTION', parentKey: 'insurance_pl.pl_surgery', sortOrder: 2 },
  { key: 'insurance_pl.pl_surgery.table.column.bd', label: 'BD Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 1 },
  { key: 'insurance_pl.pl_surgery.table.column.team_leader', label: 'Team Leader Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 2 },
  { key: 'insurance_pl.pl_surgery.table.column.surgeries', label: 'Surgeries Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 3 },
  { key: 'insurance_pl.pl_surgery.table.column.revenue', label: 'Revenue Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 4 },
  { key: 'insurance_pl.pl_surgery.table.column.expenses', label: 'Expenses Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 5 },
  { key: 'insurance_pl.pl_surgery.table.column.net_profit', label: 'Net Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_surgery.table', sortOrder: 6 },

  { key: 'insurance_pl.insurance.analytics', label: 'Insurance Analytics Section', type: 'SECTION', parentKey: 'insurance_pl.insurance', sortOrder: 1 },
  { key: 'insurance_pl.insurance.analytics.active_claims', label: 'Active Claims Card', type: 'ENTITY', parentKey: 'insurance_pl.insurance.analytics', sortOrder: 1 },
  { key: 'insurance_pl.insurance.analytics.settlement_ratio', label: 'Settlement Ratio Card', type: 'ENTITY', parentKey: 'insurance_pl.insurance.analytics', sortOrder: 2 },

  { key: 'insurance_pl.insurance.table', label: 'Insurance Claims Table', type: 'SECTION', parentKey: 'insurance_pl.insurance', sortOrder: 2 },
  { key: 'insurance_pl.insurance.table.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 1 },
  { key: 'insurance_pl.insurance.table.column.tpa', label: 'TPA Provider Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 2 },
  { key: 'insurance_pl.insurance.table.column.claim_status', label: 'Claim Status Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 3 },
  { key: 'insurance_pl.insurance.table.column.approved_amount', label: 'Approved Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.insurance.table', sortOrder: 4 },

  { key: 'insurance_pl.cash_cases.table', label: 'Cash Cases Table Section', type: 'SECTION', parentKey: 'insurance_pl.cash_cases', sortOrder: 1 },
  { key: 'insurance_pl.cash_cases.table.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'insurance_pl.cash_cases.table', sortOrder: 1 },
  { key: 'insurance_pl.cash_cases.table.column.cash_amount', label: 'Cash Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.cash_cases.table', sortOrder: 2 },
  { key: 'insurance_pl.cash_cases.table.column.received_status', label: 'Received Status Column', type: 'ENTITY', parentKey: 'insurance_pl.cash_cases.table', sortOrder: 3 },

  { key: 'insurance_pl.pl_ledger.analytics', label: 'PL Ledger Analytics', type: 'SECTION', parentKey: 'insurance_pl.pl_ledger', sortOrder: 1 },
  { key: 'insurance_pl.pl_ledger.analytics.total_revenue', label: 'Total Revenue Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.analytics', sortOrder: 1 },
  { key: 'insurance_pl.pl_ledger.analytics.total_margin', label: 'Total Margin Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.analytics', sortOrder: 2 },

  { key: 'insurance_pl.pl_ledger.table', label: 'PL Ledger Table Section', type: 'SECTION', parentKey: 'insurance_pl.pl_ledger', sortOrder: 2 },
  { key: 'insurance_pl.pl_ledger.table.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 1 },
  { key: 'insurance_pl.pl_ledger.table.column.month', label: 'Month Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 2 },
  { key: 'insurance_pl.pl_ledger.table.column.lead_received', label: 'Lead Received Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 3 },
  { key: 'insurance_pl.pl_ledger.table.column.manager', label: 'Manager Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 4 },
  { key: 'insurance_pl.pl_ledger.table.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 5 },
  { key: 'insurance_pl.pl_ledger.table.column.patient', label: 'Patient Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 6 },
  { key: 'insurance_pl.pl_ledger.table.column.category', label: 'Category Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 7 },
  { key: 'insurance_pl.pl_ledger.table.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 8 },
  { key: 'insurance_pl.pl_ledger.table.column.circle', label: 'Circle Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 9 },
  { key: 'insurance_pl.pl_ledger.table.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 10 },
  { key: 'insurance_pl.pl_ledger.table.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 11 },
  { key: 'insurance_pl.pl_ledger.table.column.admission_date', label: 'Admission Date Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 12 },
  { key: 'insurance_pl.pl_ledger.table.column.surgery_date', label: 'Surgery Date Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 13 },
  { key: 'insurance_pl.pl_ledger.table.column.payment_type', label: 'Payment Type Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 14 },
  { key: 'insurance_pl.pl_ledger.table.column.outstanding_status', label: 'PL Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 15 },
  { key: 'insurance_pl.pl_ledger.table.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 16 },
  { key: 'insurance_pl.pl_ledger.table.column.total_bill', label: 'Total Bill Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 17 },
  { key: 'insurance_pl.pl_ledger.table.column.approved_amount', label: 'Approved Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 18 },
  { key: 'insurance_pl.pl_ledger.table.column.deduction_total', label: 'Total Deduction Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 19 },
  { key: 'insurance_pl.pl_ledger.table.column.deduction_patient', label: 'Deduction Patient Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 20 },
  { key: 'insurance_pl.pl_ledger.table.column.deduction_waived', label: 'Deduction Waived Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 21 },
  { key: 'insurance_pl.pl_ledger.table.column.amount_paid', label: 'Amount Paid Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 22 },
  { key: 'insurance_pl.pl_ledger.table.column.hospital_share_pct', label: 'Hospital Share % Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 23 },
  { key: 'insurance_pl.pl_ledger.table.column.hospital_share_amt', label: 'Hospital Share Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 24 },
  { key: 'insurance_pl.pl_ledger.table.column.doctor_charges', label: 'Doctor Charges Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 25 },
  { key: 'insurance_pl.pl_ledger.table.column.implant', label: 'Implant Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 26 },
  { key: 'insurance_pl.pl_ledger.table.column.implant_paid_by', label: 'Implant Paid By Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 27 },
  { key: 'insurance_pl.pl_ledger.table.column.instruments', label: 'Instruments Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 28 },
  { key: 'insurance_pl.pl_ledger.table.column.instruments_paid_by', label: 'Instruments Paid By Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 29 },
  { key: 'insurance_pl.pl_ledger.table.column.actual_implant_cost', label: 'Actual Implant Cost Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 30 },
  { key: 'insurance_pl.pl_ledger.table.column.actual_instrument_cost', label: 'Actual Instrument Cost Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 31 },
  { key: 'insurance_pl.pl_ledger.table.column.hospital_recover_amount', label: 'Hospital Recover Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 32 },
  { key: 'insurance_pl.pl_ledger.table.column.dc', label: 'D&C Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 33 },
  { key: 'insurance_pl.pl_ledger.table.column.cab', label: 'Cab Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 34 },
  { key: 'insurance_pl.pl_ledger.table.column.referral', label: 'Referral Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 35 },
  { key: 'insurance_pl.pl_ledger.table.column.mediend_share_pct', label: 'MediEND Share % Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 36 },
  { key: 'insurance_pl.pl_ledger.table.column.mediend_share_amt', label: 'MediEND Share Amount Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 37 },
  { key: 'insurance_pl.pl_ledger.table.column.net_profit', label: 'Net Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 38 },
  { key: 'insurance_pl.pl_ledger.table.column.mediend_profit', label: 'MediEND Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 39 },
  { key: 'insurance_pl.pl_ledger.table.column.remarks', label: 'Remarks Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 40 },
  { key: 'insurance_pl.pl_ledger.table.column.hosp_payout', label: 'Hospital Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 41 },
  { key: 'insurance_pl.pl_ledger.table.column.doc_payout', label: 'Doctor Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 42 },
  { key: 'insurance_pl.pl_ledger.table.column.invoice', label: 'Invoice Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_ledger.table', sortOrder: 43 },

  { key: 'insurance_pl.pl_outstanding.analytics', label: 'PL Outstanding Analytics', type: 'SECTION', parentKey: 'insurance_pl.pl_outstanding', sortOrder: 1 },
  { key: 'insurance_pl.pl_outstanding.analytics.total_outstanding', label: 'Total Outstanding Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.analytics', sortOrder: 1 },
  { key: 'insurance_pl.pl_outstanding.analytics.overdue_cases', label: 'Overdue Cases Card', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.analytics', sortOrder: 2 },

  { key: 'insurance_pl.pl_outstanding.table', label: 'PL Outstanding Table Section', type: 'SECTION', parentKey: 'insurance_pl.pl_outstanding', sortOrder: 2 },
  { key: 'insurance_pl.pl_outstanding.table.column.lead_ref', label: 'Lead Ref Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 1 },
  { key: 'insurance_pl.pl_outstanding.table.column.actions', label: 'Actions Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 2 },
  { key: 'insurance_pl.pl_outstanding.table.column.month', label: 'Month Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 3 },
  { key: 'insurance_pl.pl_outstanding.table.column.lead_received', label: 'Lead Received Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 4 },
  { key: 'insurance_pl.pl_outstanding.table.column.manager', label: 'Manager Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 5 },
  { key: 'insurance_pl.pl_outstanding.table.column.bdm', label: 'BDM Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 6 },
  { key: 'insurance_pl.pl_outstanding.table.column.patient_name', label: 'Patient Name Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 7 },
  { key: 'insurance_pl.pl_outstanding.table.column.category', label: 'Category Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 8 },
  { key: 'insurance_pl.pl_outstanding.table.column.treatment', label: 'Treatment Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 9 },
  { key: 'insurance_pl.pl_outstanding.table.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 10 },
  { key: 'insurance_pl.pl_outstanding.table.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 11 },
  { key: 'insurance_pl.pl_outstanding.table.column.admission', label: 'Admission Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 12 },
  { key: 'insurance_pl.pl_outstanding.table.column.surgery', label: 'Surgery Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 13 },
  { key: 'insurance_pl.pl_outstanding.table.column.payment', label: 'Payment Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 14 },
  { key: 'insurance_pl.pl_outstanding.table.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 15 },
  { key: 'insurance_pl.pl_outstanding.table.column.total_bill', label: 'Total Bill Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 16 },
  { key: 'insurance_pl.pl_outstanding.table.column.approved', label: 'Approved Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 17 },
  { key: 'insurance_pl.pl_outstanding.table.column.total_deduction', label: 'Total Deduction Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 18 },
  { key: 'insurance_pl.pl_outstanding.table.column.deduction_paid_by_patient', label: 'Deduction Paid By Patient Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 19 },
  { key: 'insurance_pl.pl_outstanding.table.column.waived_off', label: 'Waived Off Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 20 },
  { key: 'insurance_pl.pl_outstanding.table.column.net_profit', label: 'Net Profit Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 21 },
  { key: 'insurance_pl.pl_outstanding.table.column.mediend_payout', label: 'MediEND Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 22 },
  { key: 'insurance_pl.pl_outstanding.table.column.mediend_pending', label: 'MediEND Pending Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 23 },
  { key: 'insurance_pl.pl_outstanding.table.column.doctor_payout', label: 'Doctor Payout Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 24 },
  { key: 'insurance_pl.pl_outstanding.table.column.doctor_pending', label: 'Doctor Pending Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 25 },
  { key: 'insurance_pl.pl_outstanding.table.column.invoice_status', label: 'Invoice Status Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 26 },
  { key: 'insurance_pl.pl_outstanding.table.column.payment_received', label: 'Payment Received Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 27 },
  { key: 'insurance_pl.pl_outstanding.table.column.remarks', label: 'Remarks Column', type: 'ENTITY', parentKey: 'insurance_pl.pl_outstanding.table', sortOrder: 28 },

  // Doctor List (insurance_pl.doctor_list)
  { key: 'insurance_pl.doctor_list.table', label: 'Doctor List Table', type: 'SECTION', parentKey: 'insurance_pl.doctor_list', sortOrder: 1 },
  { key: 'insurance_pl.doctor_list.table.column.doctor', label: 'Doctor Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 1 },
  { key: 'insurance_pl.doctor_list.table.column.cases', label: 'Cases Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 2 },
  { key: 'insurance_pl.doctor_list.table.column.total_bill', label: 'Total Bill Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 3 },
  { key: 'insurance_pl.doctor_list.table.column.paid', label: 'Paid Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 4 },
  { key: 'insurance_pl.doctor_list.table.column.pending', label: 'Pending Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 5 },
  { key: 'insurance_pl.doctor_list.table.column.doctor_share', label: 'Doctor Share Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 6 },
  { key: 'insurance_pl.doctor_list.table.column.mediend_share', label: 'MediEND Share Column', type: 'ENTITY', parentKey: 'insurance_pl.doctor_list.table', sortOrder: 7 },

  // Hospital List (insurance_pl.hospital_list)
  { key: 'insurance_pl.hospital_list.table', label: 'Hospital List Table', type: 'SECTION', parentKey: 'insurance_pl.hospital_list', sortOrder: 1 },
  { key: 'insurance_pl.hospital_list.table.column.hospital', label: 'Hospital Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 1 },
  { key: 'insurance_pl.hospital_list.table.column.cases', label: 'Cases Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 2 },
  { key: 'insurance_pl.hospital_list.table.column.amount_received', label: 'Amount Received Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 3 },
  { key: 'insurance_pl.hospital_list.table.column.pending_outstanding', label: 'Pending Outstanding Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 4 },
  { key: 'insurance_pl.hospital_list.table.column.mediend_share', label: 'MediEND Share Column', type: 'ENTITY', parentKey: 'insurance_pl.hospital_list.table', sortOrder: 5 },

  // --- MODULE 6: FINANCE & ACCOUNTS ---
  { key: 'finance.fin_payroll.table', label: 'Finance Payroll Table', type: 'SECTION', parentKey: 'finance.fin_payroll', sortOrder: 1 },
  { key: 'finance.fin_payroll.table.column.employee_name', label: 'Employee Name Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 1 },
  { key: 'finance.fin_payroll.table.column.basic_salary', label: 'Basic Salary Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 2 },
  { key: 'finance.fin_payroll.table.column.allowances', label: 'Allowances Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 3 },
  { key: 'finance.fin_payroll.table.column.deductions', label: 'Deductions Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 4 },
  { key: 'finance.fin_payroll.table.column.net_payable', label: 'Net Payable Column', type: 'ENTITY', parentKey: 'finance.fin_payroll.table', sortOrder: 5 },

  { key: 'finance.fin_ledger.table', label: 'General Ledger Table', type: 'SECTION', parentKey: 'finance.fin_ledger', sortOrder: 1 },
  { key: 'finance.fin_ledger.table.column.transaction_id', label: 'Transaction ID Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 1 },
  { key: 'finance.fin_ledger.table.column.description', label: 'Description Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 2 },
  { key: 'finance.fin_ledger.table.column.amount', label: 'Amount Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 3 },
  { key: 'finance.fin_ledger.table.column.mode', label: 'Payment Mode Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 4 },
  { key: 'finance.fin_ledger.table.column.status', label: 'Status Column', type: 'ENTITY', parentKey: 'finance.fin_ledger.table', sortOrder: 5 },
]

async function main() {
  console.log('Cleaning old RBAC resources & permissions assignments...')
  await prisma.permissionAssignment.deleteMany({})
  await prisma.resource.deleteMany({})

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
