// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout } from '../components/docs-components'

export const apiSections = {
  'api-auth': {
    title: 'API - Authentication',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Authentication uses encrypted session cookies. On login, a session cookie is set (httpOnly, secure). The frontend reads the session via GET /api/auth/me. All API routes validate the session and check RBAC permissions.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'POST',path:'/api/auth/login',description:'Login with email + password (bcryptjs verify)'},
            {method:'POST',path:'/api/auth/logout',description:'Clear session cookie'},
            {method:'GET',path:'/api/auth/me',description:'Current user session + role'},
            {method:'GET',path:'/api/profile',description:'Full user profile'},
            {method:'PATCH',path:'/api/profile',description:'Update own profile'},
            {method:'GET',path:'/api/users',description:'List all users (admin only)'},
          ]} />
        </SubSection>

        <SubSection title='Session Management'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Sessions are managed via <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lib/session.ts</code>. The session cookie contains encrypted user data. API routes call <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>getSession()</code> to authenticate, then <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>hasPermission()</code> from <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lib/rbac.ts</code> for authorization.</p>
        </SubSection>
      </>
    )
  },

  'api-leads': {
    title: 'API - Leads & Sales',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Lead management is the core of the CRM. Leads are created manually, via webhook, or synced from MySQL. Each lead goes through pipeline stages and case stages.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'GET',path:'/api/leads',description:'List leads with role-based filtering'},
            {method:'POST',path:'/api/leads',description:'Create new lead'},
            {method:'GET',path:'/api/leads/[id]',description:'Get lead with all nested relations'},
            {method:'PATCH',path:'/api/leads/[id]',description:'Update lead fields and plRecord'},
            {method:'GET',path:'/api/leads/unassigned',description:'List unassigned leads'},
            {method:'GET',path:'/api/leads/[id]/stage-history',description:'Get stage transition timeline'},
            {method:'POST',path:'/api/leads/[id]/mark-lost',description:'Mark lead as lost'},
            {method:'GET',path:'/api/call-notes',description:'List call notes for lead'},
            {method:'POST',path:'/api/call-notes',description:'Create call note'},
            {method:'POST',path:'/api/webhooks/leads',description:'External webhook to push leads'},
            {method:'POST',path:'/api/incoming-leads/process',description:'Process incoming leads from queue'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-kyp': {
    title: 'API - KYP Module',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Know Your Patient — first step in the insurance workflow. BD collects patient identity, insurance, and medical details with supporting documents.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'POST',path:'/api/kyp/submit',description:'Submit KYP basic form'},
            {method:'GET',path:'/api/kyp',description:'List KYP submissions (role-filtered)'},
            {method:'POST',path:'/api/kyp/upload',description:'Upload KYP documents to S3'},
            {method:'GET',path:'/api/kyp/[id]/edit-document',description:'Get KYP document for editing'},
            {method:'POST',path:'/api/kyp/pre-auth',description:'Submit hospital suggestions and policy fields'},
            {method:'GET',path:'/api/kyp/queries',description:'List KYP queries'},
            {method:'POST',path:'/api/kyp/queries',description:'Insurance raises a query'},
            {method:'POST',path:'/api/kyp/queries/[id]/answer',description:'Answer a KYP query'},
            {method:'POST',path:'/api/kyp/queries/[id]/resolve',description:'Resolve a KYP query'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-insurance': {
    title: 'API - Insurance',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Insurance operations covering case management, pre-auth approval, IPD tracking, and patient reset.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'GET',path:'/api/insurance/cases',description:'List insurance cases with date/status filters'},
            {method:'PATCH',path:'/api/insurance/cases/[id]',description:'Update insurance case (approve/reject)'},
            {method:'GET',path:'/api/insurance-initiate-form',description:'List insurance initiate forms'},
            {method:'GET',path:'/api/insurance-initiate-form/[id]',description:'Get initiate form details'},
            {method:'POST',path:'/api/insurance-initiate-form',description:'Create initiate form'},
            {method:'PATCH',path:'/api/insurance-initiate-form/[id]',description:'Update initiate form'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/approve',description:'Approve pre-auth request'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/reject',description:'Reject pre-auth with reason'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/hold',description:'Put pre-auth on hold'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/release-hold',description:'Release pre-auth hold'},
            {method:'POST',path:'/api/pre-auth/[kypSubId]/mark-new-hospital-raised',description:'Mark new hospital pre-auth raised'},
            {method:'POST',path:'/api/leads/[id]/raise-preauth',description:'BD raises pre-auth'},
            {method:'POST',path:'/api/leads/[id]/initiate',description:'BD marks patient admitted'},
            {method:'POST',path:'/api/leads/[id]/ipd-mark',description:'BD updates IPD status'},
            {method:'POST',path:'/api/leads/[id]/reset-patient',description:'Reset patient back to HOSPITALS_SUGGESTED'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-discharge': {
    title: 'API - Discharge & P&L',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Discharge handling (two-step: mark + fill sheet), P&L management, payment installments, and P&L categories.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'POST',path:'/api/leads/[id]/mark-discharged',description:'Insurance marks discharged with date (Step 1)'},
            {method:'GET',path:'/api/discharge-sheet',description:'List discharge sheets'},
            {method:'POST',path:'/api/discharge-sheet',description:'Create/finalize discharge sheet (Step 2)'},
            {method:'GET',path:'/api/discharge-sheet/[id]',description:'Get discharge sheet details'},
            {method:'PATCH',path:'/api/discharge-sheet/[id]',description:'Update discharge sheet (post-finalize)'},
            {method:'POST',path:'/api/discharge-sheet/[id]/create-pnl',description:'Manual P&L creation from discharge'},
            {method:'POST',path:'/api/discharge-sheet-cash',description:'Cash discharge creation'},
            {method:'GET',path:'/api/pnl/entries',description:'List P&L entries'},
            {method:'POST',path:'/api/pnl/entries',description:'Create P&L entry'},
            {method:'GET',path:'/api/pnl/categories',description:'List P&L categories'},
            {method:'POST',path:'/api/pnl/categories',description:'Create P&L category'},
            {method:'PATCH',path:'/api/pnl/categories/[id]',description:'Update P&L category'},
            {method:'GET',path:'/api/pnl/config',description:'Get P&L configuration'},
            {method:'GET',path:'/api/pnl/overview',description:'P&L overview KPIs'},
            {method:'GET',path:'/api/pnl/surgery',description:'Surgery-wise P&L'},
            {method:'GET',path:'/api/pnl/department/[dept]',description:'Department-wise P&L'},
            {method:'GET',path:'/api/pnl/google-ads',description:'Google Ads P&L'},
            {method:'GET',path:'/api/pnl/targeted/entries',description:'Targeted P&L entries'},
            {method:'GET',path:'/api/pnl/targeted/overview',description:'Targeted P&L overview'},
            {method:'GET',path:'/api/pnl/targeted/comparison',description:'Targeted vs actual comparison'},
            {method:'GET',path:'/api/installments',description:'List payment installments for a lead'},
            {method:'POST',path:'/api/installments',description:'Record payment installment'},
            {method:'DELETE',path:'/api/installments/[id]',description:'Delete installment'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-hrms': {
    title: 'API - HRMS',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Complete HRMS API covering employees, departments, attendance, leaves, payroll, recruitment, performance, documents, and mental health.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'GET',path:'/api/employees',description:'List all employees with filters'},
            {method:'POST',path:'/api/employees',description:'Create new employee'},
            {method:'GET',path:'/api/employees/[id]',description:'Get employee details'},
            {method:'PATCH',path:'/api/employees/[id]',description:'Update employee'},
            {method:'GET',path:'/api/employees/my',description:'Get current employee details'},
            {method:'POST',path:'/api/employees/onboard',description:'Onboard new employee'},
            {method:'GET',path:'/api/employees/birthdays',description:'Upcoming birthdays'},
            {method:'POST',path:'/api/employees/sync',description:'Sync employees from MySQL'},
            {method:'GET',path:'/api/departments',description:'List all departments'},
            {method:'POST',path:'/api/departments',description:'Create department'},
            {method:'GET',path:'/api/departments/[id]',description:'Get department'},
            {method:'PATCH',path:'/api/departments/[id]',description:'Update department'},
            {method:'GET',path:'/api/leaves',description:'List leave requests with pagination'},
            {method:'GET',path:'/api/leaves/my',description:'My leave requests'},
            {method:'POST',path:'/api/leaves/apply',description:'Apply for leave'},
            {method:'POST',path:'/api/leaves/[id]/approve',description:'Approve/reject leave'},
            {method:'GET',path:'/api/leaves/types',description:'List leave types'},
            {method:'POST',path:'/api/leaves/types',description:'Create leave type'},
            {method:'GET',path:'/api/attendance',description:'List attendance logs with filters'},
            {method:'GET',path:'/api/attendance/my',description:'My attendance records'},
            {method:'POST',path:'/api/attendance/sync',description:'Sync attendance from biometric'},
            {method:'POST',path:'/api/attendance/normalize/request',description:'Request attendance normalization'},
            {method:'GET',path:'/api/attendance/normalize',description:'List normalization requests'},
            {method:'POST',path:'/api/attendance/normalize/[id]/approve',description:'Approve normalization'},
            {method:'GET',path:'/api/payroll',description:'List payroll records'},
            {method:'GET',path:'/api/payroll/my',description:'My payroll records'},
            {method:'GET',path:'/api/payroll/my/[id]/slip',description:'Download payslip'},
            {method:'GET',path:'/api/hr/leave-balances',description:'List all leave balances'},
            {method:'POST',path:'/api/hr/leave-balances/bulk',description:'Bulk update leave balances'},
            {method:'GET',path:'/api/hr/interviews',description:'List interviews'},
            {method:'POST',path:'/api/hr/interviews',description:'Schedule interview'},
            {method:'GET',path:'/api/hr/increments',description:'List salary increments'},
            {method:'POST',path:'/api/hr/increments',description:'Create increment record'},
            {method:'GET',path:'/api/hr/feedback',description:'List feedback entries'},
            {method:'POST',path:'/api/hr/feedback',description:'Submit feedback'},
            {method:'GET',path:'/api/hr/documents',description:'List HR documents'},
            {method:'POST',path:'/api/hr/documents',description:'Create HR document'},
            {method:'POST',path:'/api/hr/documents/upload',description:'Upload document to S3'},
            {method:'GET',path:'/api/warnings',description:'List employee warnings'},
            {method:'POST',path:'/api/warnings',description:'Issue warning to employee'},
            {method:'GET',path:'/api/hr/mental-health',description:'Mental health check-ins'},
            {method:'POST',path:'/api/hr/mental-health',description:'Submit mental health check-in'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-finance': {
    title: 'API - Finance',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Complete finance API covering ledger (double-entry), partys, accounting heads, payment modes, projects, sales, inventory, payroll, and reports.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'GET',path:'/api/finance/ledger',description:'List ledger entries with filters'},
            {method:'POST',path:'/api/finance/ledger',description:'Create ledger entry'},
            {method:'GET',path:'/api/finance/ledger/[id]',description:'Get ledger entry'},
            {method:'DELETE',path:'/api/finance/ledger/[id]',description:'Delete ledger entry'},
            {method:'POST',path:'/api/finance/ledger/[id]/approve',description:'Approve debit entry'},
            {method:'POST',path:'/api/finance/ledger/[id]/undo',description:'Undo approval'},
            {method:'POST',path:'/api/finance/ledger/[id]/request-edit',description:'Request edit on entry'},
            {method:'POST',path:'/api/finance/ledger/[id]/approve-edit',description:'Approve edit request'},
            {method:'POST',path:'/api/finance/ledger/[id]/reject-edit',description:'Reject edit request'},
            {method:'POST',path:'/api/finance/ledger/bulk-approve',description:'Bulk approve entries'},
            {method:'GET',path:'/api/finance/parties',description:'List parties (vendors, clients)'},
            {method:'POST',path:'/api/finance/parties',description:'Create party'},
            {method:'GET',path:'/api/finance/parties/[id]',description:'Get party details'},
            {method:'GET',path:'/api/finance/heads',description:'List accounting heads'},
            {method:'POST',path:'/api/finance/heads',description:'Create accounting head'},
            {method:'GET',path:'/api/finance/payment-types',description:'List payment types'},
            {method:'GET',path:'/api/finance/payment-modes',description:'List payment modes'},
            {method:'POST',path:'/api/finance/payment-modes',description:'Create payment mode'},
            {method:'GET',path:'/api/finance/projects',description:'List finance projects'},
            {method:'POST',path:'/api/finance/projects',description:'Create project'},
            {method:'GET',path:'/api/finance/projects/[id]',description:'Get project'},
            {method:'PATCH',path:'/api/finance/projects/[id]',description:'Update project'},
            {method:'GET',path:'/api/finance/sales',description:'List sales records'},
            {method:'POST',path:'/api/finance/sales',description:'Create sale transaction'},
            {method:'GET',path:'/api/finance/sales/[id]',description:'Get sale details'},
            {method:'GET',path:'/api/finance/reports/summary',description:'Financial summary report'},
            {method:'GET',path:'/api/finance/reports/entries',description:'Financial entries report'},
            {method:'POST',path:'/api/finance/payroll/generate',description:'Generate payroll batch'},
            {method:'POST',path:'/api/finance/payroll/export-csv',description:'Export payroll CSV'},
            {method:'GET',path:'/api/finance/salary-structure',description:'List salary structures'},
            {method:'POST',path:'/api/finance/salary-structure',description:'Create salary structure'},
            {method:'GET',path:'/api/finance/inventory/items',description:'List inventory items'},
            {method:'POST',path:'/api/finance/inventory/items',description:'Create item'},
            {method:'GET',path:'/api/finance/inventory/purchases',description:'List purchases'},
            {method:'POST',path:'/api/finance/inventory/purchases',description:'Create purchase'},
            {method:'GET',path:'/api/finance/inventory/issues',description:'List issues'},
            {method:'POST',path:'/api/finance/inventory/issues',description:'Create issue'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-analytics': {
    title: 'API - Analytics',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Analytics and reporting endpoints for dashboards, leaderboards, trends, and MD-level executive views.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'GET',path:'/api/analytics/dashboard',description:'Main dashboard KPIs'},
            {method:'GET',path:'/api/analytics/leaderboard',description:'Sales leaderboard'},
            {method:'GET',path:'/api/analytics/trends',description:'Trend analysis'},
            {method:'GET',path:'/api/analytics/md/finance',description:'MD finance dashboard'},
            {method:'GET',path:'/api/analytics/md/hr',description:'MD HR dashboard'},
            {method:'GET',path:'/api/analytics/md/sales',description:'MD sales dashboard'},
            {method:'GET',path:'/api/analytics/md/outstanding',description:'MD outstanding dashboard'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-master': {
    title: 'API - Master Data',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Master data endpoints for reference lists: doctors, hospitals, insurance companies, TPAs, treatments. Used for autocomplete and dropdowns across the application.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'GET',path:'/api/masters/doctors',description:'List doctors (73 pre-populated)'},
            {method:'GET',path:'/api/masters/hospitals',description:'List hospitals (78 partner hospitals)'},
            {method:'GET',path:'/api/masters/insurance',description:'List insurance companies (37 companies)'},
            {method:'GET',path:'/api/masters/tpas',description:'List TPAs'},
            {method:'GET',path:'/api/masters/treatments',description:'List treatments'},
            {method:'GET',path:'/api/doctors',description:'Search doctors (autocomplete)'},
            {method:'GET',path:'/api/hospitals',description:'Search hospitals (autocomplete)'},
          ]} />
        </SubSection>
      </>
    )
  },

  'api-other': {
    title: 'API - Other',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Miscellaneous APIs: AI chatbot, admin tools, system health, settings, and holidays.</p>

        <SubSection title='Endpoints'>
          <APITable routes={[
            {method:'POST',path:'/api/ai/chat',description:'Role-scoped mediend AI chat (streaming + tools)'},
            {method:'GET',path:'/api/ai/capabilities',description:'Tools and suggested prompts for current user'},
            {method:'GET',path:'/api/ai/knowledge',description:'List knowledge documents (SUPER_ADMIN / EA)'},
            {method:'POST',path:'/api/ai/knowledge',description:'Create knowledge document (SUPER_ADMIN / EA)'},
            {method:'POST',path:'/api/admin/seed-users',description:'Seed test users'},
            {method:'GET',path:'/api/admin/system/health',description:'System health check'},
            {method:'GET',path:'/api/settings',description:'Get application settings'},
            {method:'GET',path:'/api/holidays',description:'List company holidays'},
            {method:'GET',path:'/api/health',description:'Basic health check'},
          ]} />
        </SubSection>
      </>
    )
  },
}
