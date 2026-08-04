// resourceMap.ts
// Single source of truth: resource.key (from backend) -> frontend page/component mapping.
// Update this file whenever a route or component is added/renamed. Never store this mapping in the DB.

export const RESOURCE_MAP = {
  // MODULES
  "main": { label: "Main Navigation", component: "MainNavigationGroup" },
  "hrm": { label: "Human Resource Management", component: "HrmGroup" },
  "myhrms": { label: "My HRMS Portal", component: "MyHrmsGroup" },
  "sales": { label: "Sales & Marketing", component: "SalesGroup" },
  "insurance_pl": { label: "Insurance & P/L", component: "InsurancePlGroup" },
  "finance": { label: "Finance & Accounts", component: "FinanceGroup" },
  "actions": { label: "System Actions", component: "SystemActionsGroup" },
  "crm": { label: "CRM", component: "CrmGroup" },

  // SECTIONS / PAGES

  // Main Group Pages
  "main.home": { path: "/home", component: "HomePage" },
  "main.md_home": { path: "/md/home", component: "MDHomePage" },
  "main.tasks": { path: "/md/tasks", component: "TasksPage" },
  "main.calendar": { path: "/calendar", component: "CalendarPage" },
  "main.meets": { path: "/meets", component: "MeetsPage" },
  "main.dashboard": { path: "/dashboard", component: "DashboardPage" },
  "main.finance_dashboard": { path: "/md/finance", component: "FinanceDashboardPage" },
  "main.md_hr_dashboard": { path: "/md/hr", component: "MDHRDashboardPage" },
  "main.md_attendance": { path: "/md/attendance", component: "MDAttendancePage" },
  "main.md_leave_balances": { path: "/md/leave-balances", component: "MDLeaveBalancesPage" },
  "main.master_data": { path: "/master-data", component: "MasterDataPage" },
  "main.dept_targets": { path: "/md/targets", component: "DeptTargetsPage" },
  "main.chat": { path: "/chat", component: "ChatPage" },
  "main.training": { path: "/training", component: "TrainingPage" },
  "main.md_messages": { path: "/md/anonymous-messages", component: "MDMessagesPage" },
  "main.md_appointments": { path: "/md/appointments", component: "MDAppointmentsPage" },
  "main.company_pnl": { path: "/finance/pnl", component: "CompanyPnLPage" },
  "main.targeted_pnl": { path: "/finance/pnl/targeted", component: "TargetedPnLPage" },
  "main.md_pnl": { path: "/md/pnl", component: "MDPnLPage" },
  "main.it_pnl": { path: "/it/pnl", component: "ITPnLPage" },
  "main.loan_demat_revenue": { path: "/loan-demat/revenue", component: "LoanDematRevenuePage" },
  "main.it_permissions": { path: "/it/permissions", component: "ITPermissionsPage" },
  "main.compliance": { path: "/compliance/dashboard", component: "CompliancePage" },
  "main.md_compliance": { path: "/md/compliance", component: "MDCompliancePage" },
  "main.md_outstanding": { path: "/md/outstanding", component: "MDOutstandingPage" },
  "main.incentive": { path: "/incentives", component: "IncentivesPage" },
  "main.cumulative_report": { path: "/cumulative-report", component: "CumulativeReportPage" },
  "main.ipd_calendar": { path: "/ipd-calendar", component: "IPDCalendarPage" },
  "main.doctor_admin": { path: "/executive-assistant/doctor-admin", component: "DoctorAdminPage" },

  // CRM Group Pages
  "crm.campaigns": { path: "/crm/campaigns", component: "CrmCampaignsPage" },
  "crm.incoming_leads": { path: "/crm/incoming-leads", component: "CrmIncomingLeadsPage" },
  "crm.kpis": { path: "/crm/kpis", component: "CrmKpisPage" },
  "crm.activity": { path: "/crm/activity", component: "CrmActivityPage" },
  "crm.masters": { path: "/crm/masters", component: "CrmMastersPage" },
  "crm.access_matrix": { path: "/crm/access-matrix", component: "CrmAccessMatrixPage" },
  "crm.churn_rules": { path: "/crm/churn-rules", component: "CrmChurnRulesPage" },


  // HRM Group Pages
  "hrm.hr_dashboard": { path: "/hr/dashboard", component: "HRDashboardPage" },
  "hrm.attendance_normalizations": { path: "/hr/attendance-leaves", component: "AttendanceLeavesPage" },
  "hrm.people_org": { path: "/hr/people", component: "PeopleOrgPage" },
  "hrm.onboarding": { path: "/hr/onboarding", component: "HROnboardingPage" },
  "hrm.compensation_docs": { path: "/hr/compensation", component: "CompensationDocsPage" },
  "hrm.engagement": { path: "/hr/engagement", component: "EngagementPage" },
  "hrm.recruitment": { path: "/hr/recruitment", component: "RecruitmentPage" },

  // MyHRMS Group Pages
  "myhrms.my_core_hr": { path: "/employee/dashboard/core-hr", component: "MyCoreHRPage" },
  "myhrms.my_financial": { path: "/employee/dashboard/financial", component: "MyFinancialPage" },
  "myhrms.my_support_services": { path: "/employee/dashboard/support-services", component: "MySupportServicesPage" },
  "myhrms.my_team": { path: "/employee/my-team", component: "MyTeamPage" },
  "myhrms.ask_md_approval": { path: "/md/md-approvals", component: "AskMDApprovalPage" },

  // Sales Group Pages
  "sales.sales_dashboard": { path: "/sales/dashboard", component: "SalesDashboardPage" },
  "sales.md_sales_dashboard": { path: "/md/sales", component: "SalesDashboardPage" },
  "sales.dm_dashboard": { path: "/digital-marketing/dashboard", component: "DMDashboardPage" },
  "sales.case_tracker": { path: "/bd/kyp", component: "CaseTrackerPage" },
  "sales.pending_surgery": { path: "/reports/patient-cards-pending-surgery", component: "PendingSurgeryPage" },
  "sales.targets": { path: "/sales/targets", component: "TargetsPage" },
  "sales.team_lead_targets": { path: "/team-lead/targets", component: "TeamLeadTargetsPage" },
  "sales.sales_head_targets": { path: "/sales-head/targets", component: "SalesHeadTargetsPage" },
  "sales.sales_pnl": { path: "/sales/pnl", component: "SalesPnLPage" },
  "sales.campaign_cpl": { path: "/digital-marketing/cpl", component: "CampaignCPLPage" },
  "sales.sales_pipeline": { path: "/bd/pipeline", component: "SalesPipelinePage" },
  "sales.team_lead_pipeline": { path: "/team-lead/pipeline", component: "TeamLeadPipelinePage" },
  "sales.ea_pipeline": { path: "/executive-assistant/pipeline", component: "EAPipelinePage" },
  "sales.blueprint_dashboard": { path: "/sales/blueprint", component: "BluePrintDashboardPage" },
  "sales.opd_monitoring": { path: "/opd-monitoring", component: "OpdMonitoringPage" },

  // Insurance Group Pages
  "insurance_pl.insurance": { path: "/insurance/dashboard", component: "InsurancePage" },
  "insurance_pl.cash_cases": { path: "/insurance/cash-cases", component: "CashCasesPage" },
  "insurance_pl.pl_ledger": { path: "/pl/dashboard", component: "PLLedgerPage" },
  "insurance_pl.pl_surgery": { path: "/pl/surgery-dashboard", component: "PLSurgeryPage" },
  "insurance_pl.pl_outstanding": { path: "/pl/outstanding", component: "PLOutstandingPage" },
  "insurance_pl.doctor_list": { path: "/doctors", component: "DoctorListPage" },
  "insurance_pl.hospital_list": { path: "/hospitals", component: "HospitalListPage" },

  // Finance Group Pages
  "finance.fin_payroll": { path: "/finance/payroll", component: "FinPayrollPage" },
  "finance.fin_ledger": { path: "/finance/ledger", component: "FinLedgerPage" },
  "finance.fin_new_ledger_entry": { path: "/finance/ledger/new", component: "FinNewLedgerEntryPage" },
  "finance.fin_sales": { path: "/finance/sales", component: "FinSalesPage" },
  "finance.fin_parties": { path: "/finance/parties", component: "FinPartiesPage" },
  "finance.fin_heads": { path: "/finance/heads", component: "FinHeadsPage" },
  "finance.fin_projects": { path: "/finance/projects", component: "FinProjectsPage" },
  "finance.fin_payment_modes": { path: "/finance/payment-modes", component: "FinPaymentModesPage" },
  "finance.fin_inventory": { path: "/finance/inventory", component: "FinInventoryPage" },
  "finance.fin_approvals": { path: "/md/approvals", component: "FinApprovalsPage" },
  "finance.fin_team_approvals": { path: "/finance/team-approvals", component: "FinTeamApprovalsPage" },
  "finance.md_team_approvals": { path: "/md/md-approvals", component: "MDTeamApprovalsPage" },
  "finance.fin_reports": { path: "/finance/reports", component: "FinReportsPage" },
  "finance.fin_invoice_requests": { path: "/finance/invoice-requests", component: "FinInvoiceRequestsPage" },
  "finance.payment_verifications": { path: "/finance/payment-verifications", component: "FinPaymentVerificationsPage" },
  "finance.fin_doctor_payoff": { path: "/finance/doctor-payoff-requests", component: "FinDoctorPayoffPage" },
  "finance.fin_sales_team_cost": { path: "/finance/sales-team-cost", component: "FinSalesTeamCostPage" },
  "finance.master_seating_cost": { path: "/finance/master-seating-cost", component: "MasterSeatingCostPage" },

  // ENTITIES (Legacy Leaf Actions & static mapping)
  "leads.table.lead.column.phoneNumber": { component: "PhoneNumberColumn" },
  "leads.table.lead.column.surgeryAmount": { component: "SurgeryAmountColumn" },
  "leads.actions.create_meet": { component: "CreateMeetButton" },
  "actions.md_approval_request": { component: "MDApprovalRequestAction" },
  "actions.create_notice": { component: "CreateNoticeAction" },
  "actions.worklog_enforcement": { component: "WorklogEnforcementAction" },
  "actions.create_meet": { component: "CreateMeetAction" },
  "actions.cpl_access": { component: "CplAccessAction" },

  // Unified Database Column Registry Map
  "sales.case_tracker.table.lead.column.phoneNumber": { label: "Patient Phone Number", component: "PatientPhoneNumber" },
  "sales.case_tracker.table.lead.column.alternateNumber": { label: "Alternate Phone Number", component: "AlternatePhoneNumber" },
  "sales.case_tracker.table.lead.column.patientEmail": { label: "Patient Email Address", component: "PatientEmailAddress" },
  "sales.case_tracker.table.lead.column.netProfit": { label: "Net Profit Amount", component: "NetProfitAmount" },

  "sales.sales_pipeline.table.lead.column.phoneNumber": { label: "Patient Phone Number", component: "PatientPhoneNumber" },
  "sales.sales_pipeline.table.lead.column.alternateNumber": { label: "Alternate Phone Number", component: "AlternatePhoneNumber" },
  "sales.sales_pipeline.table.lead.column.patientEmail": { label: "Patient Email Address", component: "PatientEmailAddress" },
  "sales.sales_pipeline.table.lead.column.netProfit": { label: "Net Profit Amount", component: "NetProfitAmount" },

  "sales.team_lead_pipeline.table.lead.column.phoneNumber": { label: "Patient Phone Number", component: "PatientPhoneNumber" },
  "sales.team_lead_pipeline.table.lead.column.alternateNumber": { label: "Alternate Phone Number", component: "AlternatePhoneNumber" },
  "sales.team_lead_pipeline.table.lead.column.patientEmail": { label: "Patient Email Address", component: "PatientEmailAddress" },
  "sales.team_lead_pipeline.table.lead.column.netProfit": { label: "Net Profit Amount", component: "NetProfitAmount" },

  // Blueprint Dashboard Table Column Registry Map
  "sales.blueprint_dashboard.table.blueprint.column.name": { label: "Blueprint: Name Column", component: "BlueprintNameColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.team": { label: "Blueprint: Team Column", component: "BlueprintTeamColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.teamSize": { label: "Blueprint: Team Size Column", component: "BlueprintTeamSizeColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.targetSalaryMin": { label: "Blueprint: Target (Salary Min) Column", component: "BlueprintTargetSalaryMinColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.target": { label: "Blueprint: Target Column", component: "BlueprintTargetColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.costTotalSpend": { label: "Blueprint: Cost Total Spend Column", component: "BlueprintCostTotalSpendColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.netProfitActual": { label: "Blueprint: Net Profit Actual Column", component: "BlueprintNetProfitActualColumn" },
  "sales.blueprint_dashboard.table.blueprint.column.mediendProfit": { label: "Blueprint: MediEnd Profit Column", component: "BlueprintMediendProfitColumn" },

  // ============================================
  // NESTED LEVEL 3/4 MATRIX EXTENSIONS (ALL TABLES)
  // ============================================

  // --- MODULE 1: MAIN NAVIGATION ---
  
  // Tasks (main.tasks)
  "main.tasks.overview": { label: "Tasks: Overview Tab", component: "TasksOverviewTab" },
  "main.tasks.my_tasks": { label: "Tasks: My Tasks Tab", component: "MyTasksTab" },

  // Calendar (main.calendar)
  "main.calendar.analytics": { label: "Calendar: Analytics Section", component: "CalendarAnalyticsSection" },
  "main.calendar.calendar": { label: "Calendar: Calendar Section", component: "CalendarBoardSection" },

  // Meets (main.meets)
  "main.meets.upcoming": { label: "Meets: Upcoming Tab", component: "MeetsUpcomingTab" },
  "main.meets.history": { label: "Meets: History Tab", component: "MeetsHistoryTab" },

  // Finance Dashboard (main.finance_dashboard)
  "main.finance_dashboard.analytics": { label: "Finance Run Rate Analytics", component: "FinanceRunRateAnalytics" },
  "main.finance_dashboard.analytics.revenue_run_rate": { label: "Revenue Run Rate Card", component: "RevenueRunRateCard" },
  "main.finance_dashboard.analytics.operating_margin": { label: "Operating Margin Card", component: "OperatingMarginCard" },
  "main.finance_dashboard.analytics.cash_flow": { label: "Cash Flow Card", component: "CashFlowCard" },

  // IT Permissions (main.it_permissions)
  "main.it_permissions.table": { label: "User Directory Access Table", component: "UserDirectoryAccessTable" },
  "main.it_permissions.table.user.column.profile": { label: "Table Column: User Profile", component: "ItUserProfileColumn" },
  "main.it_permissions.table.user.column.role": { label: "Table Column: Role", component: "ItUserRoleColumn" },
  "main.it_permissions.table.user.column.department": { label: "Table Column: Department", component: "ItUserDeptColumn" },
  "main.it_permissions.table.user.column.action": { label: "Table Column: Manage Button", component: "ItUserManageColumn" },

  // IT P&L (main.it_pnl)
  "main.it_pnl.overview": { label: "IT P&L: Overview Tab", component: "ItPnlOverviewTab" },
  "main.it_pnl.projects": { label: "IT P&L: Projects Tab", component: "ItPnlProjectsTab" },
  "main.it_pnl.resources": { label: "IT P&L: Resources Tab", component: "ItPnlResourcesTab" },

  // Incentive (main.incentive)
  "main.incentive.analytics": { label: "Incentive Analytics Section", component: "IncentiveAnalyticsSection" },
  "main.incentive.table": { label: "Incentive Table Section", component: "IncentiveTableSection" },
  "main.incentive.table.incentive.column.employee_name": { label: "Table Column: Employee Name", component: "IncentiveEmployeeNameColumn" },
  "main.incentive.table.incentive.column.employee_id": { label: "Table Column: Employee ID", component: "IncentiveEmployeeIdColumn" },
  "main.incentive.table.incentive.column.department": { label: "Table Column: Department", component: "IncentiveDepartmentColumn" },
  "main.incentive.table.incentive.column.designation": { label: "Table Column: Designation", component: "IncentiveDesignationColumn" },
  "main.incentive.table.incentive.column.month": { label: "Table Column: Month", component: "IncentiveMonthColumn" },
  "main.incentive.table.incentive.column.incentive_amount": { label: "Table Column: Incentive Amount", component: "IncentiveAmountColumn" },
  "main.incentive.table.incentive.column.status": { label: "Table Column: Status", component: "IncentiveStatusColumn" },
  "main.incentive.table.incentive.column.actions": { label: "Table Column: Actions", component: "IncentiveActionsColumn" },

  // --- MODULE 2: HUMAN RESOURCE MANAGEMENT ---
  
  // Attendance & Leaves (hrm.attendance_normalizations)
  "hrm.attendance_normalizations.table": { label: "Attendance & Normalization Table", component: "AttendanceTable" },
  "hrm.attendance_normalizations.table.attendance.column.employee_name": { label: "Table Column: Employee Name", component: "AttNameColumn" },
  "hrm.attendance_normalizations.table.attendance.column.in_time": { label: "Table Column: In Time", component: "AttInTimeColumn" },
  "hrm.attendance_normalizations.table.attendance.column.out_time": { label: "Table Column: Out Time", component: "AttOutTimeColumn" },
  "hrm.attendance_normalizations.table.attendance.column.normalization_status": { label: "Table Column: Normalization Status", component: "AttStatusColumn" },

  // People & Org (hrm.people_org)
  "hrm.people_org.table": { label: "People & Org Table", component: "PeopleOrgTable" },
  "hrm.people_org.table.employee.column.name": { label: "Table Column: Employee Name", component: "EmpNameColumn" },
  "hrm.people_org.table.employee.column.designation": { label: "Table Column: Designation", component: "EmpDesignationColumn" },
  "hrm.people_org.table.employee.column.doj": { label: "Table Column: Date of Joining", component: "EmpDojColumn" },
  "hrm.people_org.table.employee.column.branch": { label: "Table Column: Branch", component: "EmpBranchColumn" },
  "hrm.people_org.table.employee.column.reports_to": { label: "Table Column: Reports To", component: "EmpReportsToColumn" },

  // Compensation & Docs (hrm.compensation_docs)
  "hrm.compensation_docs.table": { label: "Compensation Documents Table", component: "CompensationDocsTable" },
  "hrm.compensation_docs.table.compensation.column.employee_name": { label: "Table Column: Employee Name", component: "CompNameColumn" },
  "hrm.compensation_docs.table.compensation.column.ctc": { label: "Table Column: CTC Details", component: "CompCtcColumn" },
  "hrm.compensation_docs.table.compensation.column.structure": { label: "Table Column: Salary Structure", component: "CompStructureColumn" },

  // Employee Engagement (hrm.engagement)
  "hrm.engagement.analytics": { label: "Employee Engagement Analytics", component: "EngagementAnalytics" },
  "hrm.engagement.analytics.score": { label: "Engagement Score Card", component: "EngagementScoreCard" },
  "hrm.engagement.analytics.nps": { label: "Employee NPS Card", component: "EmployeeNpsCard" },
  "hrm.engagement.analytics.retention": { label: "Retention Rate Card", component: "RetentionRateCard" },

  // Recruitment (hrm.recruitment)
  "hrm.recruitment.table": { label: "Recruitment Pipeline Table", component: "RecruitmentTable" },
  "hrm.recruitment.table.jobPosting.column.job_code": { label: "Table Column: Job Code", component: "JobCodeColumn" },
  "hrm.recruitment.table.jobPosting.column.title": { label: "Table Column: Job Title", component: "JobTitleColumn" },
  "hrm.recruitment.table.jobPosting.column.openings": { label: "Table Column: Openings", component: "JobOpeningsColumn" },
  "hrm.recruitment.table.jobPosting.column.candidates": { label: "Table Column: Applied Candidates", component: "JobCandidatesColumn" },

  // --- MODULE 3: MY HRMS PORTAL ---
  
  // My Core HR (myhrms.my_core_hr)
  "myhrms.my_core_hr.attendance": { label: "My Core HR: Attendance Tab", component: "CoreHRAttendanceTab" },
  "myhrms.my_core_hr.leaves": { label: "My Core HR: Leaves Tab", component: "CoreHRLeavesTab" },
  "myhrms.my_core_hr.holidays": { label: "My Core HR: Holidays Tab", component: "CoreHRHolidaysTab" },
  "myhrms.my_core_hr.documents": { label: "My Core HR: Documents Tab", component: "CoreHRDocumentsTab" },
  "myhrms.my_core_hr.hr_policies": { label: "My Core HR: HR Policies Tab", component: "CoreHRPoliciesTab" },

  // My Financial (myhrms.my_financial)
  "myhrms.my_financial.payroll": { label: "My Financial: Payroll Tab", component: "MyFinancialPayrollTab" },
  "myhrms.my_financial.increment": { label: "My Financial: Increment Tab", component: "MyFinancialIncrementTab" },

  // My Support Services (myhrms.my_support_services)
  "myhrms.my_support_services.feedback": { label: "Support: Feedback Tab", component: "SupportFeedbackTab" },
  "myhrms.my_support_services.ticket": { label: "Support: Ticket Tab", component: "SupportTicketTab" },
  "myhrms.my_support_services.mdconnect": { label: "Support: MDConnect Tab", component: "SupportMDConnectTab" },
  "myhrms.my_support_services.mental_health": { label: "Support: Mental Health Tab", component: "SupportMentalHealthTab" },
  "myhrms.my_support_services.job_postings": { label: "Support: Job Postings Tab", component: "SupportJobPostingsTab" },

  // My Team (myhrms.my_team)
  "myhrms.my_team.attendance_leave": { label: "My Team: Attendance & Leave Tab", component: "TeamAttendanceLeaveTab" },
  "myhrms.my_team.loans": { label: "My Team: Loans Tab", component: "TeamLoansTab" },
  "myhrms.my_team.normalization": { label: "My Team: Normalization Tab", component: "TeamNormalizationTab" },

  // Ask MD Approval (myhrms.ask_md_approval)
  "myhrms.ask_md_approval.pending": { label: "MD Approval: Pending Tab", component: "MdApprovalPendingTab" },
  "myhrms.ask_md_approval.history": { label: "MD Approval: History Tab", component: "MdApprovalHistoryTab" },

  // --- MODULE 4: SALES & MARKETING ---
  "sales.case_tracker.analytics": { label: "Case Tracker Analytics", component: "CaseTrackerAnalytics" },
  "sales.case_tracker.analytics.total_leads": { label: "Total Leads Card", component: "TotalLeadsCard" },
  "sales.case_tracker.analytics.active_leads": { label: "Active Leads Card", component: "ActiveLeadsCard" },
  "sales.case_tracker.analytics.converted_leads": { label: "Converted Leads Card", component: "ConvertedLeadsCard" },
  
  "sales.case_tracker.table": { label: "Case Tracker Table", component: "CaseTrackerTable" },
  "sales.case_tracker.table.lead.column.lead_ref": { label: "Table Column: Lead Ref", component: "LeadRefColumn" },
  "sales.case_tracker.table.lead.column.date": { label: "Table Column: Date", component: "DateColumn" },
  "sales.case_tracker.table.lead.column.surgery_date": { label: "Table Column: Surgery Date", component: "SurgeryDateColumn" },
  "sales.case_tracker.table.lead.column.patient_name": { label: "Table Column: Patient Name", component: "PatientNameColumn" },
  "sales.case_tracker.table.lead.column.age_sex": { label: "Table Column: Age/Sex", component: "AgeSexColumn" },
  "sales.case_tracker.table.lead.column.circle": { label: "Table Column: Circle", component: "CircleColumn" },
  "sales.case_tracker.table.lead.column.treatment": { label: "Table Column: Treatment", component: "TreatmentColumn" },
  "sales.case_tracker.table.lead.column.bdm": { label: "Table Column: BDM", component: "BdmColumn" },
  "sales.case_tracker.table.lead.column.hospital": { label: "Table Column: Hospital", component: "HospitalColumn" },
  "sales.case_tracker.table.lead.column.doctor": { label: "Table Column: Doctor", component: "DoctorColumn" },
  "sales.case_tracker.table.lead.column.stage": { label: "Table Column: Stage", component: "StageColumn" },
  "sales.case_tracker.table.lead.column.actions": { label: "Table Column: Actions", component: "ActionsColumn" },

  "sales.sales_pipeline.table": { label: "Sales Pipeline Table", component: "SalesPipelineTable" },
  "sales.sales_pipeline.table.lead.column.lead_ref": { label: "Table Column: Lead Ref", component: "LeadRefColumn" },
  "sales.sales_pipeline.table.lead.column.date": { label: "Table Column: Date", component: "DateColumn" },
  "sales.sales_pipeline.table.lead.column.surgery_date": { label: "Table Column: Surgery Date", component: "SurgeryDateColumn" },
  "sales.sales_pipeline.table.lead.column.patient_name": { label: "Table Column: Patient Name", component: "PatientNameColumn" },
  "sales.sales_pipeline.table.lead.column.age_sex": { label: "Table Column: Age/Sex", component: "AgeSexColumn" },
  "sales.sales_pipeline.table.lead.column.circle": { label: "Table Column: Circle", component: "CircleColumn" },
  "sales.sales_pipeline.table.lead.column.treatment": { label: "Table Column: Treatment", component: "TreatmentColumn" },
  "sales.sales_pipeline.table.lead.column.bdm": { label: "Table Column: BDM", component: "BdmColumn" },
  "sales.sales_pipeline.table.lead.column.hospital": { label: "Table Column: Hospital", component: "HospitalColumn" },
  "sales.sales_pipeline.table.lead.column.doctor": { label: "Table Column: Doctor", component: "DoctorColumn" },
  "sales.sales_pipeline.table.lead.column.stage": { label: "Table Column: Stage", component: "StageColumn" },
  "sales.sales_pipeline.table.lead.column.actions": { label: "Table Column: Actions", component: "ActionsColumn" },

  "sales.team_lead_pipeline.table": { label: "Team Lead Pipeline Table", component: "TeamLeadPipelineTable" },
  "sales.team_lead_pipeline.table.lead.column.lead_ref": { label: "Table Column: Lead Ref", component: "LeadRefColumn" },
  "sales.team_lead_pipeline.table.lead.column.date": { label: "Table Column: Date", component: "DateColumn" },
  "sales.team_lead_pipeline.table.lead.column.surgery_date": { label: "Table Column: Surgery Date", component: "SurgeryDateColumn" },
  "sales.team_lead_pipeline.table.lead.column.patient_name": { label: "Table Column: Patient Name", component: "PatientNameColumn" },
  "sales.team_lead_pipeline.table.lead.column.age_sex": { label: "Table Column: Age/Sex", component: "AgeSexColumn" },
  "sales.team_lead_pipeline.table.lead.column.circle": { label: "Table Column: Circle", component: "CircleColumn" },
  "sales.team_lead_pipeline.table.lead.column.treatment": { label: "Table Column: Treatment", component: "TreatmentColumn" },
  "sales.team_lead_pipeline.table.lead.column.bdm": { label: "Table Column: BDM", component: "BdmColumn" },
  "sales.team_lead_pipeline.table.lead.column.hospital": { label: "Table Column: Hospital", component: "HospitalColumn" },
  "sales.team_lead_pipeline.table.lead.column.doctor": { label: "Table Column: Doctor", component: "DoctorColumn" },
  "sales.team_lead_pipeline.table.lead.column.stage": { label: "Table Column: Stage", component: "StageColumn" },
  "sales.team_lead_pipeline.table.lead.column.actions": { label: "Table Column: Actions", component: "ActionsColumn" },

  // OPD Monitoring (sales.opd_monitoring)
  "sales.opd_monitoring.analytics": { label: "OPD Monitoring Analytics Summary", component: "OpdMonitoringAnalytics" },
  "sales.opd_monitoring.analytics.scheduled": { label: "Scheduled Card", component: "OpdScheduledCard" },
  "sales.opd_monitoring.analytics.done": { label: "Done Card", component: "OpdDoneCard" },
  "sales.opd_monitoring.analytics.no_show": { label: "No Show Card", component: "OpdNoShowCard" },
  "sales.opd_monitoring.analytics.cancelled": { label: "Cancelled Card", component: "OpdCancelledCard" },

  "sales.opd_monitoring.daily": { label: "OPD Monitoring: Daily View Tab", component: "OpdDailyViewTab" },
  "sales.opd_monitoring.doctor": { label: "OPD Monitoring: Doctor-wise View Tab", component: "OpdDoctorViewTab" },
  "sales.opd_monitoring.overdue": { label: "OPD Monitoring: Pending / Overdue Tab", component: "OpdOverdueTab" },

  "sales.opd_monitoring.table": { label: "OPD Monitoring Table", component: "OpdMonitoringTable" },
  "sales.opd_monitoring.table.lead.column.patient_name": { label: "Table Column: Patient Name", component: "OpdPatientNameColumn" },
  "sales.opd_monitoring.table.lead.column.lead_ref": { label: "Table Column: Lead Ref", component: "OpdLeadRefColumn" },
  "sales.opd_monitoring.table.lead.column.doctor": { label: "Table Column: Doctor", component: "OpdDoctorColumn" },
  "sales.opd_monitoring.table.lead.column.hospital": { label: "Table Column: Hospital", component: "OpdHospitalColumn" },
  "sales.opd_monitoring.table.lead.column.date": { label: "Table Column: Appointment Date", component: "OpdAppointmentDateColumn" },
  "sales.opd_monitoring.table.lead.column.status": { label: "Table Column: Status", component: "OpdStatusColumn" },
  "sales.opd_monitoring.table.lead.column.bd": { label: "Table Column: BD", component: "OpdBdColumn" },

  // --- MODULE 5: INSURANCE & P/L ---
  "insurance_pl.pl_surgery.analytics": { label: "PL Surgery Analytics Section", component: "PLSurgeryAnalytics" },
  "insurance_pl.pl_surgery.analytics.total_surgeries_card": { label: "Total Surgeries Card", component: "TotalSurgeriesCard" },
  "insurance_pl.pl_surgery.analytics.revenue_card": { label: "Revenue Card", component: "RevenueCard" },
  "insurance_pl.pl_surgery.analytics.avg_margin_card": { label: "Average Margin Card", component: "AverageMarginCard" },

  "insurance_pl.pl_surgery.table": { label: "PL Surgery Table Section", component: "PLSurgeryTable" },
  "insurance_pl.pl_surgery.table.dischargeSheet.column.bd": { label: "Table Column: BD", component: "BdColumn" },
  "insurance_pl.pl_surgery.table.dischargeSheet.column.team_leader": { label: "Table Column: Team Leader", component: "TeamLeaderColumn" },
  "insurance_pl.pl_surgery.table.dischargeSheet.column.surgeries": { label: "Table Column: Surgeries", component: "SurgeriesColumn" },
  "insurance_pl.pl_surgery.table.dischargeSheet.column.revenue": { label: "Table Column: Revenue", component: "RevenueColumn" },
  "insurance_pl.pl_surgery.table.dischargeSheet.column.expenses": { label: "Table Column: Expenses", component: "ExpensesColumn" },
  "insurance_pl.pl_surgery.table.dischargeSheet.column.net_profit": { label: "Table Column: Net Profit", component: "NetProfitColumn" },

  "insurance_pl.insurance.analytics": { label: "Insurance Analytics Section", component: "InsuranceAnalytics" },
  "insurance_pl.insurance.analytics.active_claims": { label: "Active Claims Card", component: "ActiveClaimsCard" },
  "insurance_pl.insurance.analytics.settlement_ratio": { label: "Settlement Ratio Card", component: "SettlementRatioCard" },

  "insurance_pl.insurance.table": { label: "Insurance Claims Table", component: "InsuranceTable" },
  "insurance_pl.insurance.table.lead.column.patient_name": { label: "Table Column: Patient Name", component: "InsPatientNameColumn" },
  "insurance_pl.insurance.table.lead.column.tpa": { label: "Table Column: TPA Provider", component: "InsTPAColumn" },
  "insurance_pl.insurance.table.lead.column.claim_status": { label: "Table Column: Claim Status", component: "InsStatusColumn" },
  "insurance_pl.insurance.table.lead.column.approved_amount": { label: "Table Column: Approved Amount", component: "InsApprovedColumn" },

  "insurance_pl.cash_cases.table": { label: "Cash Cases Table Section", component: "CashCasesTable" },
  "insurance_pl.cash_cases.table.lead.column.patient_name": { label: "Table Column: Patient Name", component: "CashPatientNameColumn" },
  "insurance_pl.cash_cases.table.lead.column.cash_amount": { label: "Table Column: Cash Amount", component: "CashAmountColumn" },
  "insurance_pl.cash_cases.table.lead.column.received_status": { label: "Table Column: Received Status", component: "CashReceivedColumn" },

  "insurance_pl.pl_ledger.analytics": { label: "PL Ledger Analytics", component: "PLLedgerAnalytics" },
  "insurance_pl.pl_ledger.analytics.total_revenue": { label: "Total Revenue Card", component: "TotalRevenueCard" },
  "insurance_pl.pl_ledger.analytics.total_margin": { label: "Total Margin Card", component: "TotalMarginCard" },

  "insurance_pl.pl_ledger.table": { label: "PL Ledger Table Section", component: "PLLedgerTable" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.actions": { label: "Table Column: Actions", component: "LedgerActionsColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.month": { label: "Table Column: Month", component: "LedgerMonthColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.lead_received": { label: "Table Column: Lead Received", component: "LedgerLeadReceivedColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.manager": { label: "Table Column: Manager", component: "LedgerManagerColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.bdm": { label: "Table Column: BDM", component: "LedgerBdmColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.patient": { label: "Table Column: Patient", component: "LedgerPatientColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.category": { label: "Table Column: Category", component: "LedgerCategoryColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.treatment": { label: "Table Column: Treatment", component: "LedgerTreatmentColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.circle": { label: "Table Column: Circle", component: "LedgerCircleColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.doctor": { label: "Table Column: Doctor", component: "LedgerDoctorColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.hospital": { label: "Table Column: Hospital", component: "LedgerHospitalColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.admission_date": { label: "Table Column: Admission Date", component: "LedgerAdmissionDateColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.surgery_date": { label: "Table Column: Surgery Date", component: "LedgerSurgeryDateColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.payment_type": { label: "Table Column: Payment Type", component: "LedgerPaymentTypeColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.outstanding_status": { label: "Table Column: PL Status", component: "LedgerOutstandingStatusColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.status": { label: "Table Column: Status", component: "LedgerStatusColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.total_bill": { label: "Table Column: Total Bill", component: "LedgerTotalBillColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.approved_amount": { label: "Table Column: Approved Amount", component: "LedgerApprovedAmountColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.deduction_total": { label: "Table Column: Total Deduction", component: "LedgerDeductionTotalColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.deduction_patient": { label: "Table Column: Deduction Paid by Patient", component: "LedgerDeductionPatientColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.deduction_waived": { label: "Table Column: Waived Off", component: "LedgerDeductionWaivedColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.amount_paid": { label: "Table Column: Amount Paid", component: "LedgerAmountPaidColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.hospital_share_pct": { label: "Table Column: MediEND %", component: "LedgerHospitalSharePctColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.hospital_share_amt": { label: "Table Column: MediEND Share", component: "LedgerHospitalShareAmtColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.doctor_charges": { label: "Table Column: Doctor Fee", component: "LedgerDoctorChargesColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.implant": { label: "Table Column: Implant", component: "LedgerImplantColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.implant_paid_by": { label: "Table Column: Implant By", component: "LedgerImplantPaidByColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.instruments": { label: "Table Column: Instrument", component: "LedgerInstrumentsColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.instruments_paid_by": { label: "Table Column: Instrument By", component: "LedgerInstrumentsPaidByColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.actual_implant_cost": { label: "Table Column: Actual Implant", component: "LedgerActualImplantCostColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.actual_instrument_cost": { label: "Table Column: Actual Instrument", component: "LedgerActualInstrumentCostColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.hospital_recover_amount": { label: "Table Column: Hospital Recover", component: "LedgerHospitalRecoverAmountColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.dc": { label: "Table Column: D&C", component: "LedgerDcColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.cab": { label: "Table Column: Cab", component: "LedgerCabColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.referral": { label: "Table Column: Referral", component: "LedgerReferralColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.mediend_share_pct": { label: "Table Column: MediEND Net %", component: "LedgerMediendSharePctColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.mediend_share_amt": { label: "Table Column: MediEND Net", component: "LedgerMediendShareAmtColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.net_profit": { label: "Table Column: Net Profit", component: "LedgerNetProfitColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.mediend_profit": { label: "Table Column: Mediend Profit", component: "LedgerMediendProfitColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.remarks": { label: "Table Column: Remarks", component: "LedgerRemarksColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.hosp_payout": { label: "Table Column: MediEND Payout", component: "LedgerHospPayoutColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.doc_payout": { label: "Table Column: Doctor Payout", component: "LedgerDocPayoutColumn" },
  "insurance_pl.pl_ledger.table.dischargeSheet.column.invoice": { label: "Table Column: Invoice", component: "LedgerInvoiceColumn" },

  "insurance_pl.pl_outstanding.analytics": { label: "PL Outstanding Analytics", component: "PLOutstandingAnalytics" },
  "insurance_pl.pl_outstanding.analytics.total_outstanding": { label: "Total Outstanding Card", component: "TotalOutstandingCard" },
  "insurance_pl.pl_outstanding.analytics.overdue_cases": { label: "Overdue Cases Card", component: "OverdueCasesCard" },

  "insurance_pl.pl_outstanding.table": { label: "PL Outstanding Table Section", component: "PLOutstandingTable" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.lead_ref": { label: "Table Column: Lead Ref", component: "OutLeadRefColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.actions": { label: "Table Column: Actions", component: "OutActionsColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.month": { label: "Table Column: Month", component: "OutMonthColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.lead_received": { label: "Table Column: Lead Received", component: "OutLeadReceivedColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.manager": { label: "Table Column: Manager", component: "OutManagerColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.bdm": { label: "Table Column: BDM", component: "OutBdmColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.patient_name": { label: "Table Column: Patient Name", component: "OutPatientNameColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.category": { label: "Table Column: Category", component: "OutCategoryColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.treatment": { label: "Table Column: Treatment", component: "OutTreatmentColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.doctor": { label: "Table Column: Doctor", component: "OutDoctorColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.hospital": { label: "Table Column: Hospital", component: "OutHospitalColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.admission": { label: "Table Column: Admission", component: "OutAdmissionColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.surgery": { label: "Table Column: Surgery", component: "OutSurgeryColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.payment": { label: "Table Column: Payment", component: "OutPaymentColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.status": { label: "Table Column: Status", component: "OutStatusColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.total_bill": { label: "Table Column: Total Bill", component: "OutTotalBillColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.approved": { label: "Table Column: Approved", component: "OutApprovedColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.total_deduction": { label: "Table Column: Total Deduction", component: "OutTotalDeductionColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.deduction_paid_by_patient": { label: "Table Column: Deduction Paid by Patient", component: "OutDeductionPaidByPatientColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.waived_off": { label: "Table Column: Waived Off", component: "OutWaivedOffColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.net_profit": { label: "Table Column: Net Profit", component: "OutNetProfitColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.mediend_payout": { label: "Table Column: MediEND Payout", component: "OutMediendPayoutColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.mediend_pending": { label: "Table Column: MediEND Pending", component: "OutMediendPendingColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.doctor_payout": { label: "Table Column: Doctor Payout", component: "OutDoctorPayoutColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.doctor_pending": { label: "Table Column: Doctor Pending", component: "OutDoctorPendingColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.invoice_status": { label: "Table Column: Invoice Status", component: "OutInvoiceStatusColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.payment_received": { label: "Table Column: Payment Received", component: "OutPaymentReceivedColumn" },
  "insurance_pl.pl_outstanding.table.dischargeSheet.column.remarks": { label: "Table Column: Remarks", component: "OutRemarksColumn" },

  // Doctor List (insurance_pl.doctor_list)
  "insurance_pl.doctor_list.table": { label: "Doctor List Table", component: "DoctorListTable" },
  "insurance_pl.doctor_list.table.doctor.column.doctor": { label: "Table Column: Doctor", component: "DocColumn" },
  "insurance_pl.doctor_list.table.doctor.column.cases": { label: "Table Column: Cases", component: "DocCasesColumn" },
  "insurance_pl.doctor_list.table.doctor.column.total_bill": { label: "Table Column: Total Bill", component: "DocTotalBillColumn" },
  "insurance_pl.doctor_list.table.doctor.column.paid": { label: "Table Column: Paid", component: "DocPaidColumn" },
  "insurance_pl.doctor_list.table.doctor.column.pending": { label: "Table Column: Pending", component: "DocPendingColumn" },
  "insurance_pl.doctor_list.table.doctor.column.doctor_share": { label: "Table Column: Doctor Share", component: "DocShareColumn" },
  "insurance_pl.doctor_list.table.doctor.column.mediend_share": { label: "Table Column: MediEND Share", component: "DocMediendShareColumn" },

  // Hospital List (insurance_pl.hospital_list)
  "insurance_pl.hospital_list.table": { label: "Hospital List Table", component: "HospitalListTable" },
  "insurance_pl.hospital_list.table.hospital.column.hospital": { label: "Table Column: Hospital", component: "HospColumn" },
  "insurance_pl.hospital_list.table.hospital.column.cases": { label: "Table Column: Cases", component: "HospCasesColumn" },
  "insurance_pl.hospital_list.table.hospital.column.amount_received": { label: "Table Column: Amount Received", component: "HospAmtRecColumn" },
  "insurance_pl.hospital_list.table.hospital.column.pending_outstanding": { label: "Table Column: Pending Outstanding", component: "HospPendingOutColumn" },
  "insurance_pl.hospital_list.table.hospital.column.mediend_share": { label: "Table Column: MediEND Share", component: "HospMediendShareColumn" },

  // --- MODULE 6: FINANCE & ACCOUNTS ---
  "finance.fin_payroll.table": { label: "Finance Payroll Table", component: "PayrollTable" },
  "finance.fin_payroll.table.payroll.column.employee_name": { label: "Table Column: Employee Name", component: "PayNameColumn" },
  "finance.fin_payroll.table.payroll.column.basic_salary": { label: "Table Column: Basic Salary", component: "PayBasicColumn" },
  "finance.fin_payroll.table.payroll.column.allowances": { label: "Table Column: Allowances", component: "PayAllowancesColumn" },
  "finance.fin_payroll.table.payroll.column.deductions": { label: "Table Column: Deductions", component: "PayDeductionsColumn" },
  "finance.fin_payroll.table.payroll.column.net_payable": { label: "Table Column: Net Payable", component: "PayNetColumn" },

  "finance.fin_ledger.table": { label: "General Ledger Table", component: "FinLedgerTable" },
  "finance.fin_ledger.table.ledger.column.transaction_id": { label: "Table Column: Transaction ID", component: "TxIdColumn" },
  "finance.fin_ledger.table.ledger.column.description": { label: "Table Column: Description", component: "TxDescColumn" },
  "finance.fin_ledger.table.ledger.column.amount": { label: "Table Column: Amount", component: "TxAmountColumn" },
  "finance.fin_ledger.table.ledger.column.mode": { label: "Table Column: Payment Mode", component: "TxModeColumn" },
  "finance.fin_ledger.table.ledger.column.status": { label: "Table Column: Status", component: "TxStatusColumn" }
} as const;
