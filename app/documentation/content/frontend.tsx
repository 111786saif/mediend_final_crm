// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout } from '../components/docs-components'

export const frontendSections = {
  'fe-structure': {
    title: 'Frontend - Architecture',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Next.js 14+ App Router, TypeScript, React Query, shadcn/ui, Framer Motion, Recharts, FullCalendar 6. The frontend follows a component-based architecture with server/client component separation.</p>

        <SubSection title='Directory Structure'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-6'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Directory</th><th className='px-4 py-3 text-left font-medium'>Purpose</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['/app/*route', 'Pages and route handlers (App Router)'],
                  ['/app/api/*route', 'API endpoints (50+ routes)'],
                  ['/components/*', 'React components (37+ custom, 60+ shadcn/ui)'],
                  ['/components/ui/*', 'shadcn/ui primitives (button, dialog, card, table, form, etc.)'],
                  ['/hooks/*', 'Custom React hooks (14 hooks)'],
                  ['/lib/*', 'Utilities (51 files: auth, RBAC, API client, Prisma, etc.)'],
                  ['/providers/*', 'React context providers (Query, Auth, AI, BackClose)'],
                  ['/public/*', 'Static assets (icons, PWA manifest, service worker)'],
                ].map(([d, p], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{d}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Key Components'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-6'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Component</th><th className='px-4 py-3 text-left font-medium'>Lines</th><th className='px-4 py-3 text-left font-medium'>Description</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['AuthenticatedWrapper', '323', 'Main layout with sidebar, nav, auth guard'],
                  ['AppSidebar', '600+', 'Role-based sidebar with 50+ routes'],
                  ['SalesPipelineView', '400+', 'Kanban lead pipeline dashboard'],
                  ['InsuranceDashboard', '1098', 'Insurance case management with tabs and filters'],
                  ['PLDashboard', '1146', 'P&L case tracking with KPIs'],
                  ['FinanceLedgerTable', '997', 'Double-entry ledger table with editing'],
                  ['CoreHRDashboard', '1427', 'Employee self-service overview'],
                  ['MDDashboard', '899', 'Executive overview dashboard'],
                  ['DischargeSheetForm', '350+', 'Discharge form with bill breakup and deductions'],
                  ['StageProgress', '150+', '8-step case stage progress tracker'],
                  ['KanbanBoard', 'Kanban', 'Reusable kanban board with drag and drop'],
                  ['CommandPalette', 'Cmd+K', 'Global command/search palette'],
                ].map(([c, l, d], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{c}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{l}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Tech Stack Details'>
          <div className='grid md:grid-cols-3 gap-4 mb-6'>
            <Card title='UI & Styling' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Tailwind CSS for styling</li>
                <li>shadcn/ui component library (60+ primitives)</li>
                <li>Framer Motion for animations</li>
                <li>Lucide React for icons</li>
                <li>Recharts for charts and graphs</li>
                <li>FullCalendar 6 for calendar views</li>
              </ul>
            </Card>
            <Card title='State & Data' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>TanStack React Query v5 (server state)</li>
                <li>React hooks (client state)</li>
                <li>14 custom hooks (useAuth, useLeads, useTasks, etc.)</li>
                <li>Centralized API client (apiGet, apiPost, etc.)</li>
              </ul>
            </Card>
            <Card title='Auth & Session' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Encrypted session cookies (httpOnly)</li>
                <li>Route guard in AuthenticatedWrapper</li>
                <li>Role-based sidebar rendering</li>
                <li>Feature-level permission toggles</li>
              </ul>
            </Card>
          </div>
        </SubSection>
      </>
    )
  },

  'fe-components': {
    title: 'Key Components',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Detailed overview of the major React components powering the application.</p>

        <div className='grid md:grid-cols-2 gap-4 mb-6'>
          <Card title='AuthenticatedWrapper' description='Root layout wrapper. Handles: auth guard, sidebar rendering, mobile bottom nav, notification bell, command palette, worklog enforcer, meet reminders, BMI calculator.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: ~323. Renders children in a flex container with sidebar on desktop.</p>
          </Card>
          <Card title='AppSidebar' description='Role-based navigation sidebar with 55+ routes organized by domain. Each section collapses/expands. Badge counts show pending actions.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 600+. Uses navItems from lib/sidebar-nav.ts.</p>
          </Card>
          <Card title='SalesPipelineView' description='Kanban-style lead pipeline dashboard. Shows leads in status buckets with drag-and-drop. Includes filters, search, and quick actions.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 400+. Reuses KanbanBoard and KanbanColumn components.</p>
          </Card>
          <Card title='InsuranceDashboard' description='Insurance work queue with 8+ tabs (KYP Complete, Pre-Auth Raised, To Mark Discharged, To Fill Sheet, etc.). Global filters for month, BD, circle, treatment.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 1098. State saved to localStorage for persistence.</p>
          </Card>
          <Card title='PLDashboard' description='P&L overview dashboard. Shows discharged cases with KPIs: total profit, average ticket, pending payouts.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 1146. Click row → /pl/record/[leadId] for editing.</p>
          </Card>
          <Card title='FinanceLedgerTable' description='Double-entry ledger table. Supports CREDIT/DEBIT/SELF_TRANSFER types. Inline editing, approval workflows, edit request cycles.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 997. Full audit trail integration.</p>
          </Card>
          <Card title='MDDashboard' description='Executive overview for MD. Shows finance, HR, sales, compliance, and outstanding KPIs in a single page.'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 899. Multi-tab dashboard with drill-down.</p>
          </Card>
          <Card title='StageProgress' description='8-step visual progress tracker for insurance cases. Shows current stage, completed stages, and actor (BD vs Insurance).'>
            <p className='text-xs mt-2 text-gray-500'>Lines: 150+. Cash flow variant: CashStageProgress (4 steps).</p>
          </Card>
        </div>
      </>
    )
  },

  'fe-navigation': {
    title: 'Navigation System',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The CRM uses role-based navigation with a desktop sidebar and mobile bottom nav. Navigation items are defined in <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lib/sidebar-nav.ts</code> (55+ items) and filtered by user role and permissions.</p>

        <SubSection title='Desktop Sidebar'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>The sidebar shows sections based on user role. Each section collapses to show child pages. Badge counts indicate pending actions (tasks, approvals, notifications).</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Section</th><th className='px-4 py-3 text-left font-medium'>Routes</th><th className='px-4 py-3 text-left font-medium'>Audience</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['Home', '/home, /md/home', 'Role-dependent landing'],
                  ['Dashboard', '/bd/dashboard, /hr/dashboard, /md/dashboard', 'Role-specific KPIs'],
                  ['Pipeline', '/bd/pipeline, /team-lead/pipeline', 'BD and Team Lead'],
                  ['Case Tracker', '/bd/kyp-case-tracker', 'BD KYP workflow'],
                  ['HRM Section', '/hr/*', 'HR only'],
                  ['MyHrms', '/employee/*, /attendance, /leaves', 'All employees'],
                  ['Sales', '/sales/dashboard, /sales/targets', 'Sales Head and above'],
                  ['Insurance & P/L', '/insurance/*, /pl/*, /outstanding/*', 'Insurance, PL, Outstanding'],
                  ['Finance', '/finance/*', 'Finance team'],
                  ['MD', '/md/*, /md-approvals', 'MD and ADMIN'],
                ].map(([s, r, a], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium'>{s}</td><td className='px-4 py-3 font-mono text-xs'>{r}</td><td className='px-4 py-3'>{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Mobile Bottom Navigation'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Fixed bottom navigation bar with 5 items. The center Home button is always present. Other items depend on role permissions.</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Nav Items' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Tasks (left) — pending task badge</li>
                <li>Approvals (left-center) — pending approval badge</li>
                <li>Home (center) — always present, acts as profile</li>
                <li>Messages (right-center) — for BD, Insurance, MD</li>
                <li>Notifications (right) — badge for unread count</li>
              </ul>
            </Card>
            <Card title='Features' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Role-dependent visibility</li>
                <li>Badge counts via useBadgeCounts hook</li>
                <li>Active state highlighting</li>
                <li>Hides on scroll down, shows on scroll up</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Command Palette'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Cmd+K (or Ctrl+K) opens a global search palette. Users can search across pages, leads, employees, and actions. The palette is rendered in AuthenticatedWrapper.</p>
        </SubSection>

        <SubSection title='Notification System'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>In-app notifications with 30+ types covering all domains. Notifications appear in the bell icon in the top bar. Web push notifications are also supported via PushSubscription model and lib/push.ts.</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Domain</th><th className='px-4 py-3 text-left font-medium'>Notification Types</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['Leads / Sales', 'Lead assigned, lead lost, call note added'],
                  ['Insurance', 'KYP submit, pre-auth raised/approved/rejected, discharge'],
                  ['Chat', 'New case chat message'],
                  ['Tasks', 'Task assigned, completed, rated, warning'],
                  ['HRMS', 'Leave approved/rejected, attendance normalized'],
                  ['Finance', 'Ledger entry approved, edit requested'],
                  ['MD', 'MD approval request, anonymous message'],
                  ['System', 'Onboarding, ticket update, notice published'],
                ].map(([d, t], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium'>{d}</td><td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },

  'fe-state': {
    title: 'State Management',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Server state is managed via TanStack React Query v5. Client state uses React hooks. Auth state is managed via encrypted session cookies with RBAC middleware on both frontend and backend.</p>

        <SubSection title='Custom Hooks'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>14 custom hooks encapsulate data fetching and state logic:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Core Hooks' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>useAuth — session, role, permissions</li>
                <li>useLeads — paginated lead list with filters</li>
                <li>useTasks — task CRUD + assignee/status filters</li>
                <li>useNotifications — notification list + badge count</li>
                <li>useBadgeCounts — sidebar badge counts</li>
              </ul>
            </Card>
            <Card title='Feature Hooks' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>useFileUpload — S3 upload with progress</li>
                <li>usePushSubscription — web push registration</li>
                <li>useComplianceCalls — post-discharge calls</li>
                <li>useWorkLogs — daily work log check-in/out</li>
                <li>useCalendar — events and scheduling</li>
                <li>useMDTeam — MD team data</li>
                <li>useSettings — app settings cache</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Data Flow'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-xs font-mono text-gray-800 dark:text-gray-200'>
{`1. Component calls custom hook (e.g., useLeads)
2. Hook calls apiGet/apiPost from lib/api-client.ts
3. React Query caches and deduplicates the request
4. Server validates via Zod schemas and RBAC middleware
5. Prisma ORM executes the database query
6. Response updates React Query cache, triggers re-render
7. Optimistic updates for mutations (task complete, etc.)`}
            </pre>
          </div>
        </SubSection>

        <Callout type='info' title='API Client'>
          All API calls go through centralized functions: <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>apiGet</code>, <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>apiPost</code>, <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>apiPut</code>, <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>apiPatch</code>, <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>apiDelete</code> in <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lib/api-client.ts</code>. They handle auth headers, error handling, and response parsing automatically.
        </Callout>
      </>
    )
  },
}
