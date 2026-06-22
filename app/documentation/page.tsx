// @ts-nocheck
'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { DocumentationSidebar } from './components/sidebar'
import { Section, SubSection, APITable, Card, Callout, PipelineCard } from './components/docs-components'

export default function DocumentationPage() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState(false)
  const PIN = 'documentation@mediend2026'

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Mediend CRM</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter the documentation PIN to continue</p>
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (pin === PIN) setUnlocked(true)
                else setPinError(true)
              }
            }}
            className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          {pinError && <p className="text-sm text-red-500 mb-4">Incorrect PIN. Try again.</p>}
          <button
            onClick={() => { if (pin === PIN) setUnlocked(true); else setPinError(true) }}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  const [activeSection, setActiveSection] = useState('getting-started')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!searchQuery.trim()) {
      const el = document.getElementById(activeSection)
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeSection])

  const searchTerm = searchQuery.toLowerCase().trim()

  const sections = useMemo(() => ({
    'hrms-employees': {
      title: 'Employee Management',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Employee Management covers recruitment, onboarding, departments, teams, and status tracking.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/employees',description:'List all employees with filters'},
    {method:'POST',path:'/api/employees',description:'Create new employee'},
    {method:'GET',path:'/api/employees/[id]',description:'Get employee details'},
    {method:'PATCH',path:'/api/employees/[id]',description:'Update employee'},
    {method:'GET',path:'/api/departments',description:'List departments'},
    {method:'POST',path:'/api/departments',description:'Create department'},
    {method:'GET',path:'/api/departments/[id]',description:'Get department'},
    {method:'GET',path:'/api/hierarchy/org-chart',description:'Organization chart'},
    {method:'GET',path:'/api/hierarchy/my-team',description:'My team members'},
  ]} />
</SubSection>
        </>
      )
    },
    'hrms-attendance': {
      title: 'Attendance System',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Biometric integration, check-in/out, normalization requests.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/attendance',description:'List attendance logs'},
    {method:'GET',path:'/api/attendance/my',description:'My attendance'},
    {method:'GET',path:'/api/attendance/stats',description:'Attendance statistics'},
    {method:'POST',path:'/api/attendance/sync',description:'Sync from biometric'},
    {method:'GET',path:'/api/attendance/normalize',description:'Normalization requests'},
    {method:'POST',path:'/api/attendance/normalize/request',description:'Request correction'},
    {method:'POST',path:'/api/attendance/normalize/[id]/approve',description:'HR approve'},
  ]} />
</SubSection>
        </>
      )
    },
    'hrms-leaves': {
      title: 'Leave Management',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Leave applications, approvals, balances, accrual, carry-forward.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/leaves',description:'List leave requests'},
    {method:'GET',path:'/api/leaves/my',description:'My leave requests'},
    {method:'POST',path:'/api/leaves/apply',description:'Apply for leave'},
    {method:'POST',path:'/api/leaves/[id]/approve',description:'Approve/reject leave'},
    {method:'GET',path:'/api/leaves/types',description:'List leave types'},
    {method:'GET',path:'/api/hr/leave-balances',description:'Leave balances'},
    {method:'POST',path:'/api/hr/leave-balances/bulk',description:'Bulk update balances'},
  ]} />
</SubSection>
        </>
      )
    },
    'hrms-payroll': {
      title: 'Payroll',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Monthly payslip generation from attendance, leaves, increments.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/payroll',description:'List payroll records'},
    {method:'POST',path:'/api/payroll',description:'Create payroll'},
    {method:'GET',path:'/api/payroll/my',description:'My payroll'},
    {method:'GET',path:'/api/payroll/my/[id]/slip',description:'Download payslip'},
    {method:'POST',path:'/api/finance/payroll/generate',description:'Generate payroll batch'},
    {method:'GET',path:'/api/finance/payroll',description:'Finance payroll view'},
  ]} />
</SubSection>
        </>
      )
    },
    'hrms-recruitment': {
      title: 'Recruitment',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Job postings, interviews, internal job postings (IJP).</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/hr/interviews',description:'List interviews'},
    {method:'POST',path:'/api/hr/interviews',description:'Schedule interview'},
    {method:'GET',path:'/api/hr/interviews/[id]',description:'Get interview'},
    {method:'PATCH',path:'/api/hr/interviews/[id]',description:'Update interview'},
    {method:'GET',path:'/api/hr/ijp',description:'Internal job postings'},
    {method:'POST',path:'/api/hr/ijp',description:'Create IJP'},
  ]} />
</SubSection>
        </>
      )
    },
    'hrms-performance': {
      title: 'Performance',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Increments, feedback, warnings, mental health check-ins.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/hr/increments',description:'List increments'},
    {method:'POST',path:'/api/hr/increments',description:'Create increment'},
    {method:'GET',path:'/api/hr/feedback',description:'List feedback'},
    {method:'POST',path:'/api/hr/feedback',description:'Submit feedback'},
    {method:'GET',path:'/api/warnings',description:'List warnings'},
    {method:'POST',path:'/api/warnings',description:'Issue warning'},
    {method:'GET',path:'/api/hr/mental-health',description:'Mental health check-ins'},
  ]} />
</SubSection>
        </>
      )
    },
    'hrms-documents': {
      title: 'Documents',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>HR documents, policies, acknowledgments, employee files.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/hr/documents',description:'List HR documents'},
    {method:'POST',path:'/api/hr/documents',description:'Create document'},
    {method:'POST',path:'/api/hr/documents/upload',description:'Upload to S3'},
    {method:'GET',path:'/api/hr/documents/[id]',description:'Get document'},
    {method:'PATCH',path:'/api/hr/documents/[id]',description:'Update document'},
    {method:'GET',path:'/api/documents/acknowledge',description:'Awaiting acknowledgment'},
  ]} />
</SubSection>
        </>
      )
    },
    'finance-ledger': {
      title: 'Ledger and Accounting',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Double-entry bookkeeping with Credit/Debit/Self-transfer and approval workflows.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/finance/ledger',description:'List ledger entries with filters'},
    {method:'POST',path:'/api/finance/ledger',description:'Create entry'},
    {method:'GET',path:'/api/finance/ledger/[id]',description:'Get entry'},
    {method:'POST',path:'/api/finance/ledger/[id]/approve',description:'Approve debit'},
    {method:'POST',path:'/api/finance/ledger/[id]/undo',description:'Undo approval'},
    {method:'POST',path:'/api/finance/ledger/[id]/request-edit',description:'Request edit'},
    {method:'POST',path:'/api/finance/ledger/[id]/approve-edit',description:'Approve edit'},
    {method:'GET',path:'/api/finance/reports/summary',description:'Financial summary'},
  ]} />
</SubSection>
        </>
      )
    },
    'finance-parties': {
      title: 'Parties and Heads',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Parties (vendors, clients), accounting heads, payment modes, salary structures.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/finance/parties',description:'List parties'},
    {method:'POST',path:'/api/finance/parties',description:'Create party'},
    {method:'GET',path:'/api/finance/heads',description:'List accounting heads'},
    {method:'POST',path:'/api/finance/heads',description:'Create head'},
    {method:'GET',path:'/api/finance/payment-types',description:'List payment types'},
    {method:'GET',path:'/api/finance/payment-modes',description:'List payment modes'},
    {method:'GET',path:'/api/finance/salary-structure',description:'List salary structures'},
  ]} />
</SubSection>
        </>
      )
    },
    'finance-projects': {
      title: 'Projects and Inventory',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Project accounting, sales records, inventory management.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/finance/projects',description:'List projects'},
    {method:'POST',path:'/api/finance/projects',description:'Create project'},
    {method:'GET',path:'/api/finance/sales',description:'List sales'},
    {method:'POST',path:'/api/finance/sales',description:'Create sale'},
    {method:'GET',path:'/api/finance/inventory/items',description:'List items'},
    {method:'POST',path:'/api/finance/inventory/purchases',description:'Create purchase'},
    {method:'POST',path:'/api/finance/inventory/issues',description:'Create issue'},
  ]} />
</SubSection>
        </>
      )
    },
    'finance-payroll': {
      title: 'Finance Payroll',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Finance-level payroll generation, CSV export, bulk status updates.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/finance/payroll',description:'Finance payroll view'},
    {method:'POST',path:'/api/finance/payroll/generate',description:'Generate payroll'},
    {method:'POST',path:'/api/finance/payroll/export-csv',description:'Export CSV'},
    {method:'GET',path:'/api/finance/payroll/attendance-summary',description:'Attendance summary'},
  ]} />
</SubSection>
        </>
      )
    },
    'pl-dashboard': {
      title: 'PL Dashboard',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>PL Dashboard shows all discharged cases with stage PL or COMPLETED. KPIs include profit, ticket sizes, and pending payouts.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/pnl/overview',description:'PL overview'},
    {method:'GET',path:'/api/pnl/surgery',description:'Surgery-wise PL'},
    {method:'GET',path:'/api/pnl/department/[dept]',description:'Department PL'},
    {method:'GET',path:'/api/pnl/targeted/overview',description:'Targeted PL overview'},
    {method:'GET',path:'/api/pnl/targeted/comparison',description:'Budget vs actual comparison'},
  ]} />
</SubSection>
        </>
      )
    },
    'pl-record': {
      title: 'PL Record Entry',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>PLRecord tracks per-case profit, payout statuses, and revenue splits. Auto-created when discharge sheet is finalized.</p>
<SubSection title='Profit Calculation'>
  <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 mb-4'>
{`hospAmount = billAmount * hospShare% / 100
medAmount = billAmount * mediendShare% / 100
costs = referral + cabCharges + dcCharges + doctor + implants
netProfit = medAmount - costs
closedAt = auto when both payoutStatus = PAID`}
  </pre>
</SubSection>
        </>
      )
    },
    'outstanding-dashboard': {
      title: 'Outstanding Dashboard',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Tracks post-PL payments for discharged cases with pipelineStage PL or COMPLETED.</p>
<SubSection title='APIs'>
  <APITable routes={[
    {method:'GET',path:'/api/outstanding',description:'List outstanding cases'},
    {method:'PATCH',path:'/api/outstanding/[leadId]',description:'Update payout statuses'},
    {method:'POST',path:'/api/outstanding/sync',description:'Sync PLRecord to OutstandingCase'},
  ]} />
</SubSection>
        </>
      )
    },
    'outstanding-edit': {
      title: 'Edit Outstanding',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Edit payout statuses and follow-up notes. OUTSTANDING_HEAD or ADMIN only.</p>
<SubSection title='Editable Fields'>
  <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700'>
    <table className='w-full text-sm'>
      <thead className='bg-gray-50 dark:bg-gray-800'><tr><th className='px-4 py-3 text-left font-medium'>Field</th><th className='px-4 py-3 text-left font-medium'>Values</th></tr></thead>
      <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
        {[['hospitalPayoutStatus','PENDING / PARTIAL / PAID'],['doctorPayoutStatus','PENDING / PARTIAL / PAID'],['mediendInvoiceStatus','PENDING / SENT / PAID'],['hospitalAmountPending','number'],['doctorAmountPending','number'],['paymentReceived','Received / Pending']].map(([f,v],i)=>(
          <tr key={i}><td className='px-4 py-3 font-medium'>{f}</td><td className='px-4 py-3'>{v}</td></tr>
        ))}
      </tbody>
    </table>
  </div>
</SubSection>
        </>
      )
    },
    'insurance-process': {
      title: 'Insurance Flow Process',
      Component: () => (
        <>
          <div className='space-y-3'><p className='text-gray-700'>1. Lead created (BD) - KYP Basic Form - KYP_BASIC_COMPLETE</p>
<p className='text-gray-700'>2. Insurance suggests hospitals - HOSPITALS_SUGGESTED - Pipeline: INSURANCE</p>
<p className='text-gray-700'>3. BD raises pre-auth - PREAUTH_RAISED</p>
<p className='text-gray-700'>4. Insurance approves - PREAUTH_COMPLETE</p>
<p className='text-gray-700'>5. BD marks admitted (IPD Details) - INITIATED</p>
<p className='text-gray-700'>6. BD marks IPD_DONE - moves to Insurance queue</p>
<p className='text-gray-700'>7. Insurance marks discharged (date only) - DISCHARGED</p>
<p className='text-gray-700'>8. Insurance fills discharge sheet (finalize) - PLRecord auto-created - Pipeline: PL</p></div>
<Callout type='warning' title='Two-step Discharge'>Step 1: Mark Discharged (date only, no PL), Step 2: Fill Sheet (finalize, creates PLRecord, move to PL)</Callout>
        </>
      )
    },
    'cash-process': {
      title: 'Cash Flow Process',
      Component: () => (
        <>
          <div className='space-y-3'><p className='text-gray-700'>1. BD switches lead to cash mode - CASH_IPD_PENDING</p>
<p className='text-gray-700'>2. BD fills IPD Cash Form - CASH_IPD_SUBMITTED</p>
<p className='text-gray-700'>3. Insurance reviews: APPROVED or ON_HOLD</p>
<p className='text-gray-700'>4. If on hold, BD re-edits and re-submits</p>
<p className='text-gray-700'>5. Insurance fills cash discharge - CASH_DISCHARGED - PLRecord auto-created</p></div>
        </>
      )
    },
    'pl-process': {
      title: 'PL Process',
      Component: () => (
        <>
          <div className='space-y-3'><p className='text-gray-700'>1. Discharge sheet finalized - PLRecord auto-created</p>
<p className='text-gray-700'>2. PL team reviews at /pl/dashboard</p>
<p className='text-gray-700'>3. Edit at /pl/record/[leadId]: payout statuses, amounts, shares</p>
<p className='text-gray-700'>4. Profit: mediendShare - costs = mediendNetProfit</p>
<p className='text-gray-700'>5. When both payout = PAID - closedAt auto-set</p></div>
        </>
      )
    },
    'outstanding-process': {
      title: 'Outstanding Process',
      Component: () => (
        <>
          <div className='space-y-3'><p className='text-gray-700'>1. PLRecord exists with PENDING payout statuses</p>
<p className='text-gray-700'>2. Sync: POST /api/outstanding/sync</p>
<p className='text-gray-700'>3. Review at /outstanding/dashboard</p>
<p className='text-gray-700'>4. Edit statuses at /outstanding/edit/[leadId]</p>
<p className='text-gray-700'>5. Update hospital/doctor/mediend payouts until all PAID</p></div>
        </>
      )
    },
    'api-auth': {
      title: 'API Authentication',
      Component: () => (
        <>
          <SubSection title='Endpoints'>
  <APITable routes={[
    {method:'POST',path:'/api/auth/login',description:'Login with credentials'},
    {method:'POST',path:'/api/auth/logout',description:'Logout'},
    {method:'GET',path:'/api/auth/me',description:'Current user session'},
    {method:'GET',path:'/api/profile',description:'Full user profile'},
    {method:'PATCH',path:'/api/profile',description:'Update own profile'},
    {method:'GET',path:'/api/users',description:'List all users (admin)'},
  ]} />
</SubSection>
        </>
      )
    },
    'api-master': {
      title: 'Master Data APIs',
      Component: () => (
        <>
          <SubSection title='Endpoints'>
  <APITable routes={[
    {method:'GET',path:'/api/masters/doctors',description:'List doctors'},
    {method:'GET',path:'/api/masters/hospitals',description:'List hospitals'},
    {method:'GET',path:'/api/masters/insurance',description:'List insurance companies'},
    {method:'GET',path:'/api/masters/tpas',description:'List TPAs'},
    {method:'GET',path:'/api/masters/treatments',description:'List treatments'},
    {method:'GET',path:'/api/doctors',description:'Search doctors (autocomplete)'},
    {method:'GET',path:'/api/hospitals',description:'Search hospitals (autocomplete)'},
  ]} />
</SubSection>
        </>
      )
    },
    'api-analytics': {
      title: 'Analytics APIs',
      Component: () => (
        <>
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
    'api-other': {
      title: 'Other APIs',
      Component: () => (
        <>
          <SubSection title='Endpoints'>
  <APITable routes={[
    {method:'POST',path:'/api/ai/chat',description:'AI chatbot'},
    {method:'POST',path:'/api/admin/seed-users',description:'Seed test users'},
    {method:'GET',path:'/api/admin/system/health',description:'System health'},
    {method:'GET',path:'/api/settings',description:'Get settings'},
    {method:'GET',path:'/api/holidays',description:'List holidays'},
    {method:'GET',path:'/api/health',description:'Health check'},
  ]} />
</SubSection>
        </>
      )
    },
    'fe-structure': {
      title: 'Frontend Architecture',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Next.js 16 App Router, TypeScript, React Query, shadcn/ui, Framer Motion, Recharts, FullCalendar 6.</p>
<div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-6'>
  <table className='w-full text-sm'>
    <thead className='bg-gray-50 dark:bg-gray-800'><tr><th className='px-4 py-3 text-left font-medium'><strong>Directory</strong></th><th className='px-4 py-3 text-left font-medium'><strong>Purpose</strong></th></tr></thead>
    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
      {[['/app/*route','Pages and route handlers'],['/app/api/*route','API endpoints'],['/components/*','React components (37 UI + custom)'],['/hooks/*','Custom React hooks (14 hooks)'],['/lib/*','Utilities (51 files)'],['/providers/*','React context providers']].map(([d,p],i)=>(
        <tr key={i} className='hover:bg-gray-50'><td className='px-4 py-3 font-mono text-xs'>{d}</td><td className='px-4 py-3'>{p}</td></tr>
      ))}
    </tbody>
  </table>
</div>
<SubSection title='Key Components'>
  <table className='w-full text-sm border'>
    <thead className='bg-gray-50 dark:bg-gray-800'><tr><th className='px-4 py-3 text-left'>Component</th><th className='px-4 py-3 text-left'>Description</th></tr></thead>
    <tbody className='divide-y divide-gray-200'>
      {[['AuthenticatedWrapper','Main layout with sidebar/nav'],['StageProgress','8-step case stage tracker'],['SalesPipelineView','Kanban pipeline dashboard'],['InsuranceDashboard','1098-line case management'],['FinanceLedgerTable','Double-entry ledger'],['PLDashboard','1146-line PL tracking'],['MDDashboard','899-line executive overview']].map(([c,d],i)=>(
        <tr key={i} className='hover:bg-gray-50'><td className='px-4 py-3 font-mono text-xs'>{c}</td><td className='px-4 py-3'>{d}</td></tr>
      ))}
    </tbody>
  </table>
</SubSection>
<SubSection title='State Management'>
  <p className='text-gray-700 dark:text-gray-300 mb-4'>Server state: TanStack React Query. Client state: React hooks. 14 custom hooks: useAuth, useLeads, useTasks, useNotifications, useBadgeCounts, useFileUpload, usePushSubscription, useComplianceCalls, etc.</p>
</SubSection>
<SubSection title='Navigation'>
  <div className='grid md:grid-cols-2 gap-4'>
    <Card title='Desktop Sidebar' description='Role-based with expandable sections: Home, Dashboard, Pipeline, HRM, Finance.' />
    <Card title='Mobile Bottom Nav' description='Fixed bottom with 5 items: Home (center), Tasks, Approvals, Messages, Profile.' />
  </div>
</SubSection>
        </>
      )
    },
    'pl-surgery': {
      title: 'Surgery P&amp;L',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>Surgery-wise P&amp;L dashboard tracks per-surgery profitability at the hospital case level.</p>
          <SubSection title="Key Features">
            <ul className="space-y-2 text-gray-700 dark:text-gray-300 mb-6">
              <li>Revenue tracking per surgery: bill amount, share percentages, deductions</li>
              <li>Profit calculation: Mediend share minus all applicable costs</li>
              <li>Date range filtering for surgery P&amp;L reports</li>
              <li>Doctor-wise and hospital-wise profit breakdown</li>
            </ul>
          </SubSection>
          <SubSection title="APIs">
            <APITable routes={[
              { method: 'GET', path: '/api/analytics/pl-surgery-dashboard', description: 'Surgery dashboard data' },
              { method: 'GET', path: '/api/analytics/pl-pipeline-stats', description: 'P&amp;L pipeline statistics' },
              { method: 'GET', path: '/api/pnl/surgery', description: 'Surgery-wise P&amp;L entries' },
            ]} />
          </SubSection>
        </>
      )
    },
    'api-leads': {
      title: 'API - Leads &amp; Sales',
      Component: () => (
        <>
          <SubSection title="Endpoints">
            <APITable routes={[
              { method: 'GET', path: '/api/leads', description: 'List leads with role-based filtering' },
              { method: 'POST', path: '/api/leads', description: 'Create new lead' },
              { method: 'GET', path: '/api/leads/[id]', description: 'Get lead with all nested relations' },
              { method: 'PATCH', path: '/api/leads/[id]', description: 'Update lead fields and plRecord' },
              { method: 'GET', path: '/api/leads/unassigned', description: 'List unassigned leads' },
              { method: 'GET', path: '/api/leads/[id]/stage-history', description: 'Get stage transition timeline' },
              { method: 'POST', path: '/api/leads/[id]/mark-lost', description: 'Mark lead as lost' },
              { method: 'GET', path: '/api/call-notes', description: 'List call notes for lead' },
              { method: 'POST', path: '/api/call-notes', description: 'Create call note' },
              { method: 'POST', path: '/api/webhooks/leads', description: 'External webhook to push leads' },
              { method: 'POST', path: '/api/incoming-leads/process', description: 'Process incoming leads from queue' },
            ]} />
          </SubSection>
        </>
      )
    },
    'api-kyp': {
      title: 'API - KYP Module',
      Component: () => (
        <>
          <SubSection title="Endpoints">
            <APITable routes={[
              { method: 'POST', path: '/api/kyp/submit', description: 'Submit KYP basic form' },
              { method: 'GET', path: '/api/kyp', description: 'List KYP submissions (role-filtered)' },
              { method: 'POST', path: '/api/kyp/upload', description: 'Upload KYP documents to S3' },
              { method: 'GET', path: '/api/kyp/[id]/edit-document', description: 'Get KYP document for editing' },
              { method: 'POST', path: '/api/kyp/pre-auth', description: 'Submit hospital suggestions and policy fields' },
              { method: 'GET', path: '/api/kyp/queries', description: 'List KYP queries' },
              { method: 'POST', path: '/api/kyp/queries', description: 'Insurance raises a query' },
              { method: 'POST', path: '/api/kyp/queries/[id]/answer', description: 'Answer a KYP query' },
              { method: 'POST', path: '/api/kyp/queries/[id]/resolve', description: 'Resolve a KYP query' },
            ]} />
          </SubSection>
        </>
      )
    },
    'api-insurance': {
      title: 'API - Insurance',
      Component: () => (
        <>
          <SubSection title="Endpoints">
            <APITable routes={[
              { method: 'GET', path: '/api/insurance/cases', description: 'List insurance cases with date/status filters' },
              { method: 'PATCH', path: '/api/insurance/cases/[id]', description: 'Update insurance case (approve/reject)' },
              { method: 'GET', path: '/api/insurance-initiate-form', description: 'List insurance initiate forms' },
              { method: 'GET', path: '/api/insurance-initiate-form/[id]', description: 'Get initiate form details' },
              { method: 'POST', path: '/api/insurance-initiate-form', description: 'Create initiate form' },
              { method: 'PATCH', path: '/api/insurance-initiate-form/[id]', description: 'Update initiate form' },
              { method: 'POST', path: '/api/pre-auth/[kypSubId]/approve', description: 'Approve pre-auth request' },
              { method: 'POST', path: '/api/pre-auth/[kypSubId]/reject', description: 'Reject pre-auth with reason' },
              { method: 'POST', path: '/api/pre-auth/[kypSubId]/hold', description: 'Put pre-auth on hold' },
              { method: 'POST', path: '/api/pre-auth/[kypSubId]/release-hold', description: 'Release pre-auth hold' },
              { method: 'POST', path: '/api/pre-auth/[kypSubId]/mark-new-hospital-raised', description: 'Mark new hospital pre-auth raised' },
              { method: 'POST', path: '/api/leads/[id]/raise-preauth', description: 'BD raises pre-auth' },
              { method: 'POST', path: '/api/leads/[id]/initiate', description: 'BD marks patient admitted' },
              { method: 'POST', path: '/api/leads/[id]/ipd-mark', description: 'BD updates IPD status (ADMITTED/IPD_DONE/POSTPONED/CANCELLED)' },
              { method: 'POST', path: '/api/leads/[id]/reset-patient', description: 'Reset patient back to Hospitals Suggested' },
            ]} />
          </SubSection>
        </>
      )
    },
    'api-discharge': {
      title: 'API - Discharge &amp; P&amp;L',
      Component: () => (
        <>
          <SubSection title="Endpoints">
            <APITable routes={[
              { method: 'POST', path: '/api/leads/[id]/mark-discharged', description: 'Insurance marks discharged with date (Step 1)' },
              { method: 'GET', path: '/api/discharge-sheet', description: 'List discharge sheets' },
              { method: 'POST', path: '/api/discharge-sheet', description: 'Create/finalize discharge sheet (Step 2)' },
              { method: 'GET', path: '/api/discharge-sheet/[id]', description: 'Get discharge sheet details' },
              { method: 'PATCH', path: '/api/discharge-sheet/[id]', description: 'Update discharge sheet (post-finalize)' },
              { method: 'POST', path: '/api/discharge-sheet/[id]/create-pnl', description: 'Manual P&amp;L creation from discharge' },
              { method: 'POST', path: '/api/discharge-sheet-cash', description: 'Cash discharge creation' },
              { method: 'GET', path: '/api/pnl/entries', description: 'List P&amp;L entries' },
              { method: 'POST', path: '/api/pnl/entries', description: 'Create P&amp;L entry' },
              { method: 'GET', path: '/api/pnl/categories', description: 'List P&amp;L categories' },
              { method: 'POST', path: '/api/pnl/categories', description: 'Create P&amp;L category' },
              { method: 'PATCH', path: '/api/pnl/categories/[id]', description: 'Update P&amp;L category' },
              { method: 'GET', path: '/api/pnl/config', description: 'Get P&amp;L configuration' },
              { method: 'GET', path: '/api/pnl/overview', description: 'P&amp;L overview' },
              { method: 'GET', path: '/api/pnl/surgery', description: 'Surgery-wise P&amp;L' },
              { method: 'GET', path: '/api/pnl/department/[dept]', description: 'Department-wise P&amp;L' },
              { method: 'GET', path: '/api/pnl/google-ads', description: 'Google Ads P&amp;L' },
              { method: 'GET', path: '/api/pnl/targeted/entries', description: 'Targeted P&amp;L entries' },
              { method: 'GET', path: '/api/pnl/targeted/overview', description: 'Targeted P&amp;L overview' },
              { method: 'GET', path: '/api/pnl/targeted/comparison', description: 'Targeted vs actual comparison' },
              { method: 'GET', path: '/api/installments', description: 'List payment installments for a lead' },
              { method: 'POST', path: '/api/installments', description: 'Record payment installment' },
              { method: 'DELETE', path: '/api/installments/[id]', description: 'Delete installment' },
            ]} />
          </SubSection>
        </>
      )
    },
    'api-hrms': {
      title: 'API - HRMS',
      Component: () => (
        <>
          <SubSection title="Endpoints">
            <APITable routes={[
              { method: 'GET', path: '/api/employees', description: 'List all employees with filters' },
              { method: 'POST', path: '/api/employees', description: 'Create new employee' },
              { method: 'GET', path: '/api/employees/[id]', description: 'Get employee details' },
              { method: 'PATCH', path: '/api/employees/[id]', description: 'Update employee' },
              { method: 'GET', path: '/api/employees/my', description: 'Get current employee details' },
              { method: 'POST', path: '/api/employees/onboard', description: 'Onboard new employee' },
              { method: 'GET', path: '/api/employees/birthdays', description: 'Upcoming birthdays' },
              { method: 'POST', path: '/api/employees/sync', description: 'Sync employees from MySQL' },
              { method: 'GET', path: '/api/departments', description: 'List all departments' },
              { method: 'POST', path: '/api/departments', description: 'Create department' },
              { method: 'GET', path: '/api/departments/[id]', description: 'Get department' },
              { method: 'PATCH', path: '/api/departments/[id]', description: 'Update department' },
              { method: 'GET', path: '/api/leaves', description: 'List leave requests with pagination' },
              { method: 'GET', path: '/api/leaves/my', description: 'My leave requests' },
              { method: 'POST', path: '/api/leaves/apply', description: 'Apply for leave' },
              { method: 'POST', path: '/api/leaves/[id]/approve', description: 'Approve/reject leave' },
              { method: 'GET', path: '/api/leaves/types', description: 'List leave types' },
              { method: 'POST', path: '/api/leaves/types', description: 'Create leave type' },
              { method: 'GET', path: '/api/attendance', description: 'List attendance logs with filters' },
              { method: 'GET', path: '/api/attendance/my', description: 'My attendance records' },
              { method: 'POST', path: '/api/attendance/sync', description: 'Sync attendance from biometric' },
              { method: 'POST', path: '/api/attendance/normalize/request', description: 'Request attendance normalization' },
              { method: 'GET', path: '/api/attendance/normalize', description: 'List normalization requests' },
              { method: 'POST', path: '/api/attendance/normalize/[id]/approve', description: 'Approve normalization' },
              { method: 'GET', path: '/api/payroll', description: 'List payroll records' },
              { method: 'GET', path: '/api/payroll/my', description: 'My payroll records' },
              { method: 'GET', path: '/api/payroll/my/[id]/slip', description: 'Download payslip' },
              { method: 'GET', path: '/api/hr/leave-balances', description: 'List all leave balances' },
              { method: 'POST', path: '/api/hr/leave-balances/bulk', description: 'Bulk update leave balances' },
              { method: 'GET', path: '/api/hr/interviews', description: 'List interviews' },
              { method: 'POST', path: '/api/hr/interviews', description: 'Schedule interview' },
              { method: 'GET', path: '/api/hr/increments', description: 'List salary increments' },
              { method: 'POST', path: '/api/hr/increments', description: 'Create increment record' },
              { method: 'GET', path: '/api/hr/feedback', description: 'List feedback entries' },
              { method: 'POST', path: '/api/hr/feedback', description: 'Submit feedback' },
              { method: 'GET', path: '/api/hr/documents', description: 'List HR documents' },
              { method: 'POST', path: '/api/hr/documents', description: 'Create HR document' },
              { method: 'POST', path: '/api/hr/documents/upload', description: 'Upload document to S3' },
              { method: 'GET', path: '/api/warnings', description: 'List employee warnings' },
              { method: 'POST', path: '/api/warnings', description: 'Issue warning to employee' },
              { method: 'GET', path: '/api/hr/mental-health', description: 'Mental health check-ins' },
              { method: 'POST', path: '/api/hr/mental-health', description: 'Submit mental health check-in' },
            ]} />
          </SubSection>
        </>
      )
    },
    'api-finance': {
      title: 'API - Finance',
      Component: () => (
        <>
          <SubSection title="Endpoints">
            <APITable routes={[
              { method: 'GET', path: '/api/finance/ledger', description: 'List ledger entries with filters' },
              { method: 'POST', path: '/api/finance/ledger', description: 'Create ledger entry' },
              { method: 'GET', path: '/api/finance/ledger/[id]', description: 'Get ledger entry' },
              { method: 'DELETE', path: '/api/finance/ledger/[id]', description: 'Delete ledger entry' },
              { method: 'POST', path: '/api/finance/ledger/[id]/approve', description: 'Approve debit entry' },
              { method: 'POST', path: '/api/finance/ledger/[id]/undo', description: 'Undo approval' },
              { method: 'POST', path: '/api/finance/ledger/[id]/request-edit', description: 'Request edit on entry' },
              { method: 'POST', path: '/api/finance/ledger/[id]/approve-edit', description: 'Approve edit request' },
              { method: 'POST', path: '/api/finance/ledger/[id]/reject-edit', description: 'Reject edit request' },
              { method: 'POST', path: '/api/finance/ledger/bulk-approve', description: 'Bulk approve entries' },
              { method: 'GET', path: '/api/finance/parties', description: 'List parties (vendors, clients)' },
              { method: 'POST', path: '/api/finance/parties', description: 'Create party' },
              { method: 'GET', path: '/api/finance/parties/[id]', description: 'Get party details' },
              { method: 'GET', path: '/api/finance/heads', description: 'List accounting heads' },
              { method: 'POST', path: '/api/finance/heads', description: 'Create accounting head' },
              { method: 'GET', path: '/api/finance/payment-types', description: 'List payment types' },
              { method: 'GET', path: '/api/finance/payment-modes', description: 'List payment modes' },
              { method: 'POST', path: '/api/finance/payment-modes', description: 'Create payment mode' },
              { method: 'GET', path: '/api/finance/projects', description: 'List finance projects' },
              { method: 'POST', path: '/api/finance/projects', description: 'Create project' },
              { method: 'GET', path: '/api/finance/projects/[id]', description: 'Get project' },
              { method: 'PATCH', path: '/api/finance/projects/[id]', description: 'Update project' },
              { method: 'GET', path: '/api/finance/sales', description: 'List sales records' },
              { method: 'POST', path: '/api/finance/sales', description: 'Create sale transaction' },
              { method: 'GET', path: '/api/finance/sales/[id]', description: 'Get sale details' },
              { method: 'GET', path: '/api/finance/reports/summary', description: 'Financial summary report' },
              { method: 'GET', path: '/api/finance/reports/entries', description: 'Financial entries report' },
              { method: 'POST', path: '/api/finance/payroll/generate', description: 'Generate payroll batch' },
              { method: 'POST', path: '/api/finance/payroll/export-csv', description: 'Export payroll CSV' },
              { method: 'GET', path: '/api/finance/salary-structure', description: 'List salary structures' },
              { method: 'POST', path: '/api/finance/salary-structure', description: 'Create salary structure' },
              { method: 'GET', path: '/api/finance/inventory/items', description: 'List inventory items' },
              { method: 'POST', path: '/api/finance/inventory/items', description: 'Create item' },
              { method: 'GET', path: '/api/finance/inventory/purchases', description: 'List purchases' },
              { method: 'POST', path: '/api/finance/inventory/purchases', description: 'Create purchase' },
              { method: 'GET', path: '/api/finance/inventory/issues', description: 'List issues' },
              { method: 'POST', path: '/api/finance/inventory/issues', description: 'Create issue' },
            ]} />
          </SubSection>
        </>
      )
    },
    'fe-components': {
      title: 'Frontend - Key Components',
      Component: () => (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr><th className="px-4 py-3 text-left font-medium">Component</th><th className="px-4 py-3 text-left font-medium">Lines</th><th className="px-4 py-3 text-left font-medium">Description</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[['AuthenticatedWrapper','323','Main layout with sidebar, nav, auth guard'],['AppSidebar','600+','Role-based sidebar with 50+ routes'],['SalesPipelineView','400+','Kanban lead pipeline dashboard'],['InsuranceDashboard','1098','Insurance case management'],['PLDashboard','1146','P&L case tracking with KPIs'],['FinanceLedgerTable','997','Double-entry ledger'],['CoreHRDashboard','1427','Employee self-service overview'],['MDDashboard','899','Executive overview'],['DischargeSheetForm','350+','Discharge form with bill breakup'],['StageProgress','150+','8-step case stage progress tracker']].map(([c,l,d],i)=>(
                  <tr key={i} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{c}</td><td className="px-4 py-3">{l}</td><td className="px-4 py-3">{d}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )
    },
    'fe-navigation': {
      title: 'Frontend - Navigation System',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>The CRM uses role-based navigation with desktop sidebar and mobile bottom nav.</p>
          <SubSection title="Desktop Sidebar">
            <p className='text-gray-700 dark:text-gray-300 mb-4'>The sidebar shows sections based on user role. Each section collapses to show child pages. Badge counts indicate pending actions.</p>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300 mb-6">
              <li><strong>Home</strong> - /home or /md/home (role-dependent)</li>
              <li><strong>Tasks</strong> - Personal and team task management</li>
              <li><strong>Dashboard</strong> - Role-specific KPI dashboards</li>
              <li><strong>Pipeline</strong> - Lead pipeline (BD and Team Lead)</li>
              <li><strong>Case Tracker</strong> - KYP workflow status</li>
              <li><strong>HRM Section</strong> - Attendance, People, Compensation (HR only)</li>
              <li><strong>MyHrms</strong> - Employee self-service (all users)</li>
              <li><strong>Sales</strong> - Dashboard, DM Dashboard, Targets, PL</li>
              <li><strong>Insurance &amp; P/L</strong> - Insurance, Cash Cases, PL Dashboard, Surgery</li>
              <li><strong>Finance</strong> - Payroll, Ledger, Sales, Parties, Projects</li>
              <li><strong>MD</strong> - Executive dashboards, approvals, watchlist</li>
            </ul>
          </SubSection>
          <SubSection title="Mobile Bottom Navigation">
            <p className='text-gray-700 dark:text-gray-300 mb-4'>Fixed bottom navigation with 5 items. The center Home button is always present. Other items depend on role permissions.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Nav Items" description="Tasks (left), Approvals, Home/Profile, Messages/Settings, Notifications">
                <ul className="text-xs mt-3 space-y-1">
                  <li>Tasks - with pending task badge</li>
                  <li>Approvals - with pending approval badge</li>
                  <li>Home - center, always present</li>
                  <li>Messages - for BDs, Insurance, MD</li>
                  <li>Profile - rightmost, for all users</li>
                </ul>
              </Card>
            </div>
          </SubSection>
        </>
      )
    },
    'fe-state': {
      title: 'Frontend - State Management',
      Component: () => (
        <>
          <p className='text-gray-700 dark:text-gray-300 mb-6'>The CRM uses TanStack React Query for server state and React hooks for client state. Auth state is managed via a session cookie with RBAC middleware.</p>
          <SubSection title="Custom Hooks">
            <APITable routes={[
              { method: 'HOOK', path: 'useAuth', description: 'Current user session, role, and permissions' },
              { method: 'HOOK', path: 'useLeads', description: 'Lead list with filters and pagination' },
              { method: 'HOOK', path: 'useTasks', description: 'Task CRUD with assignee/status filters' },
              { method: 'HOOK', path: 'useNotifications', description: 'User notification list and badge counts' },
              { method: 'HOOK', path: 'useBadgeCounts', description: 'Navigation badge counts for sidebar' },
              { method: 'HOOK', path: 'useFileUpload', description: 'S3 file upload with progress tracking' },
              { method: 'HOOK', path: 'usePushSubscription', description: 'Web push notification subscription' },
              { method: 'HOOK', path: 'useComplianceCalls', description: 'Post-discharge compliance calls' },
              { method: 'HOOK', path: 'useSettings', description: 'Application settings cache' },
              { method: 'HOOK', path: 'useWorkLogs', description: 'Work log check-in/check-out' },
              { method: 'HOOK', path: 'useCalendar', description: 'Calendar events and scheduling' },
              { method: 'HOOK', path: 'useMDTeam', description: 'MD dashboard team data' },
            ]} />
          </SubSection>
          <SubSection title="Data Flow">
            <ol className="space-y-3 text-gray-700 dark:text-gray-300 list-decimal list-inside">
              <li>Custom hook calls apiGet/apiPost from lib/api-client</li>
              <li>React Query caches and deduplicates requests</li>
              <li>Server validates via Zod schemas and RBAC middleware</li>
              <li>Prisma ORM executes database queries</li>
              <li>Response updates React Query cache, triggers re-render</li>
              <li>Optimistic updates for mutations (task completion, etc.)</li>
            </ol>
          </SubSection>
          <Callout type="info" title="API Client">
            All API calls go through centralized functions: apiGet, apiPost, apiPut, apiPatch, apiDelete in lib/api-client.ts. They handle auth headers, error handling, and response parsing automatically.
          </Callout>
        </>
      )
    },
  }), [])

  const displayedSections = useMemo(() => {
    if (!searchTerm) return Object.keys(sections)
    return Object.keys(sections).filter((k) => {
      const s = sections[k]
      if (!s) return false
      return k.toLowerCase().includes(searchTerm) || s.title.toLowerCase().includes(searchTerm)
    })
  }, [sections, searchTerm])

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-950'>
      <DocumentationSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className='md:ml-72'>
        <div className='sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm'>
          <div className='max-w-4xl mx-auto px-6 py-4'>
            <div className='flex items-center justify-between mb-2'>
              <div className='text-2xl font-bold text-gray-900 dark:text-white'>Mediend CRM Documentation</div>
              <input type='text' placeholder='Search...' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className='w-64 px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500' />
            </div>
            <div className='text-xs text-gray-500'>Click sidebar to navigate. Search to filter.</div>
          </div>
        </div>
        <div className='max-w-4xl mx-auto px-6 py-8 space-y-12'>
          {searchTerm && <div className='text-sm text-gray-500'>Showing {displayedSections.length} section{displayedSections.length !== 1 ? 's' : ''}</div>}
          {displayedSections.map(k => {
            const s = sections[k]
            return s ? <Section key={k} id={k} title={s.title}><s.Component /></Section> : null
          })}
        </div>
        <div className='mx-6 pb-8 border-t pt-8 max-w-4xl'>
          <a href='/login' className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700'>Go to Login</a>
        </div>
      </div>
    </div>
  )
}
