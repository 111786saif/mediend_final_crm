// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout } from '../components/docs-components'

export const overviewSections = {
  'getting-started': {
    title: 'Getting Started',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Mediend CRM v2 is a full-stack healthcare CRM built with Next.js 14+, TypeScript, Prisma (PostgreSQL), and Tailwind CSS. The system manages patient leads, insurance workflows, HRMS, finance, compliance, and executive dashboards.</p>

        <SubSection title='Prerequisites'>
          <div className='grid md:grid-cols-2 gap-4 mb-6'>
            <Card title='Node.js' description='v18+ required (v20 recommended)' />
            <Card title='PostgreSQL' description='v14+ database instance' />
            <Card title='npm / yarn' description='Package manager of choice' />
            <Card title='AWS S3' description='Document/file storage bucket' />
          </div>
        </SubSection>

        <SubSection title='Environment Variables'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Variable</th><th className='px-4 py-3 text-left font-medium'>Description</th><th className='px-4 py-3 text-left font-medium'>Required</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['DATABASE_URL', 'PostgreSQL connection string', 'Yes'],
                  ['NEXT_PUBLIC_APP_URL', 'Public app URL (e.g. https://crm.example.com)', 'Yes'],
                  ['SESSION_SECRET', 'Session encryption key (min 32 chars)', 'Yes'],
                  ['S3_ACCESS_KEY_ID', 'AWS S3 access key', 'Yes'],
                  ['S3_SECRET_ACCESS_KEY', 'AWS S3 secret key', 'Yes'],
                  ['S3_BUCKET_NAME', 'AWS S3 bucket name', 'Yes'],
                  ['S3_REGION', 'AWS S3 region (e.g. ap-south-1)', 'Yes'],
                  ['MYSQL_SOURCE_URL', 'Legacy MySQL sync connection string', 'Optional'],
                  ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'Web push notifications public key', 'Optional'],
                  ['VAPID_PRIVATE_KEY', 'Web push notifications private key', 'Optional'],
                  ['VAPID_SUBJECT', 'Push notification subject (mailto:)', 'Optional'],
                  ['HISTORIC_SYNC_FROM_DATE', 'MySQL sync start date (default: 2025-12-01)', 'Optional'],
                ].map(([v, d, r], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{v}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                    <td className='px-4 py-3'><span className='inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700'>{r}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Installation'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300'>
            <p><strong>1. Clone and install dependencies:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>git clone &lt;repo-url&gt; mediend-crm-v2<br/>cd mediend-crm-v2<br/>npm install</pre>
            <p><strong>2. Configure environment:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>cp .env.example .env<br/># Edit .env with your credentials</pre>
            <p><strong>3. Push database schema:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npx prisma generate<br/>npx prisma db push</pre>
            <p><strong>4. Seed test data:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npm run db:seed<br/># Or use the admin UI: POST /api/admin/seed-users</pre>
            <p><strong>5. Start development server:</strong></p>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npm run dev<br/># Open http://localhost:3000</pre>
          </div>
        </SubSection>

        <SubSection title='Build & Deploy'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300'>
            <pre className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'>npm run build<br/>npm start</pre>
            <p>Docker deploy also supported — see <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>docker-compose.yml</code> and <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>deploy.sh</code>.</p>
          </div>
        </SubSection>

        <SubSection title='Available Scripts'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Command</th><th className='px-4 py-3 text-left font-medium'>Description</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['npm run dev', 'Start dev server with Turbopack'],
                  ['npm run build', 'Production build'],
                  ['npm start', 'Start production server'],
                  ['npm run lint', 'Run ESLint'],
                  ['npm run db:push', 'Push Prisma schema to DB'],
                  ['npm run db:migrate', 'Run Prisma migrations'],
                  ['npm run db:seed', 'Seed database with test data'],
                  ['npm run db:studio', 'Open Prisma Studio (GUI DB browser)'],
                  ['npm run sync:leads', 'Incremental MySQL lead sync'],
                  ['npm run sync:historic:leads', 'Historic MySQL lead backfill'],
                  ['npm run verify:mysql', 'Verify MySQL connection before sync'],
                ].map(([c, d], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{c}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },

  'roles-permissions': {
    title: 'Roles & Permissions',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The system uses a role-based access control (RBAC) system with 33 user roles and 56 granular permissions. Permissions are checked on both frontend (UI visibility) and backend (API guards).</p>

        <SubSection title='Role Hierarchy'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Role</th><th className='px-4 py-3 text-left font-medium'>Domain</th><th className='px-4 py-3 text-left font-medium'>Access Level</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['MD', 'Executive', 'Full system access, all dashboards and approvals'],
                  ['ADMIN', 'System', 'Near-full access, system health and settings'],
                  ['TESTER', 'QA', 'Broad access for testing all modules'],
                  ['EXECUTIVE_ASSISTANT', 'Cross-domain', 'Insurance, HRMS, sales P&L, compliance R/W'],
                  ['SALES_HEAD', 'Sales', 'Leads, targets, analytics, hierarchy, sales P&L'],
                  ['CATEGORY_MANAGER', 'Sales', 'Mid-layer under Sales Head; recursive subtree analytics, lead assignment, set team targets'],
                  ['ASSISTANT_CATEGORY_MANAGER', 'Sales', 'Same as TEAM_LEAD (name only)'],
                  ['TEAM_LEAD', 'Sales', 'Pipeline (own + subordinates), targets, hierarchy'],
                  ['BD', 'Sales', 'Lead pipeline, targets read, analytics read'],
                  ['INSURANCE_HEAD', 'Insurance', 'Full insurance + create dept/users, hierarchy'],
                  ['INSURANCE', 'Insurance', 'Insurance case processing'],
                  ['PL_HEAD', 'P&L', 'P&L R/W, master data, create dept/users'],
                  ['PL_ENTRY', 'P&L', 'P&L data entry'],
                  ['OUTSTANDING_HEAD', 'Outstanding', 'Outstanding R/W, lead read, hierarchy'],
                  ['HR_HEAD', 'HRMS', 'Full HRMS, finance payroll read'],
                  ['FINANCE_HEAD', 'Finance', 'Ledger, sales, masters, payroll, IT P&L, hierarchy'],
                  ['FINANCE_ENTRY', 'Finance', 'Finance data entry'],
                  ['DIGITAL_MARKETING_HEAD', 'Marketing', 'Analytics, lead read, sales/PL P&L read'],
                  ['IT_HEAD', 'IT', 'IT permissions, IT P&L, users/employee read'],
                  ['LOAN_DEMAT_HEAD', 'Loans', 'Analytics, hierarchy read'],
                  ['COMPLIANCE_HEAD', 'Compliance', 'Compliance R/W, lead read, patient pages read-only'],
                  ['COMPLIANCE_CALLER', 'Compliance', 'Compliance call execution'],
                  ['OPD_COORDINATOR', 'OPD', 'OPD case management'],
                  ['USER', 'Self-service', 'Own attendance, leaves, payroll read'],
                  ['BRANCH_MANAGER', 'Branch', 'Branch-level access'],
                  ['BRANCH_EMPLOYEE', 'Branch', 'Branch employee access'],
                  ['DOCTOR', 'Medical', 'Doctor-specific view'],
                  ['RECEPTIONIST', 'Front desk', 'Patient appointment management'],
                  ['COLLECTING_AGENT', 'Collections', 'Payment collection'],
                  ['HOSPITAL_EMPLOYEE', 'Hospital', 'Hospital partner view'],
                  ['PHARMA', 'Pharmacy', 'Pharmacy module access'],
                  ['LAB', 'Lab', 'Lab module access'],
                  ['AMBULANCE', 'Ambulance', 'Ambulance services'],
                ].map(([r, d, a], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium text-gray-800 dark:text-gray-200'>{r}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Permission System'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Permissions are string-based and follow the pattern <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>domain:action</code>. The <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>lib/rbac.ts</code> file defines 56 permissions mapped per role.</p>

          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='leads:*' description='Lead management (read, write, assign, delete)'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>leads:read - View leads</li>
                <li>leads:write - Create/update leads</li>
                <li>leads:assign - Assign leads to BDs</li>
                <li>leads:delete - Delete leads</li>
              </ul>
            </Card>
            <Card title='insurance:*' description='Insurance operations'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>insurance:read - View insurance cases</li>
                <li>insurance:write - Process insurance cases</li>
              </ul>
            </Card>
            <Card title='finance:*' description='Finance operations'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>finance:read - View financial data</li>
                <li>finance:write - Create/edit entries</li>
                <li>finance:approve - Approve transactions</li>
              </ul>
            </Card>
            <Card title='hrms:*' description='HRMS sub-permissions'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>hrms:attendance:read/write</li>
                <li>hrms:leaves:read/write</li>
                <li>hrms:payroll:read/write</li>
                <li>hrms:employees:read/write</li>
                <li>hrms:recruitment:read/write</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Feature Permissions'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Additional IT-toggleable feature permissions via the <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>UserFeaturePermission</code> table. Managed by IT_HEAD through the IT permissions interface.</p>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Feature Key</th><th className='px-4 py-3 text-left font-medium'>Description</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['md_approval_request', 'Who can request MD approval on financial actions'],
                  ['create_notice', 'Who can publish notice board items'],
                  ['worklog_enforcement', 'Require work log submission for user'],
                  ['create_meet', 'Who can schedule calendar meets'],
                  ['cpl_access', 'Who can see campaign CPL cost data'],
                ].map(([k, d], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{k}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },

  'architecture': {
    title: 'Architecture',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Mediend CRM is built on a modern full-stack JavaScript architecture with Next.js App Router, PostgreSQL, and cloud-native deployment.</p>

        <SubSection title='Technology Stack'>
          <div className='grid md:grid-cols-3 gap-4 mb-6'>
            <Card title='Frontend' description='Next.js 14+ App Router, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Recharts, FullCalendar 6'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>React 18 with server/client components</li>
                <li>TanStack React Query v5 (server state)</li>
                <li>60+ shadcn/ui primitives</li>
                <li>Custom hooks architecture (14 hooks)</li>
              </ul>
            </Card>
            <Card title='Backend' description='Next.js API Routes, Prisma ORM, PostgreSQL'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>50+ API endpoints across 10+ domains</li>
                <li>Zod validation on all inputs</li>
                <li>RBAC middleware on every route</li>
                <li>File uploads via AWS S3</li>
              </ul>
            </Card>
            <Card title='Infrastructure' description='Docker, PostgreSQL, AWS S3, Web Push'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Docker Compose for local dev</li>
                <li>nginx reverse proxy config included</li>
                <li>MySQL legacy DB sync pipeline</li>
                <li>Cloudflare Worker for cron/push</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Data Flow Architecture'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-4'>
            <div className='text-sm font-mono text-gray-800 dark:text-gray-200 space-y-2'>
              <p className='font-semibold'>Request Lifecycle:</p>
              <p className='pl-4'>1. Browser → Next.js (App Router) → Layout → Page Component</p>
              <p className='pl-4'>2. Page → Custom Hook (useLeads, useAuth, etc.)</p>
              <p className='pl-4'>3. Hook → apiGet/apiPost (lib/api-client.ts) → Fetch API</p>
              <p className='pl-4'>4. API Route → Session check → RBAC guard → Zod validation</p>
              <p className='pl-4'>5. → Prisma ORM → PostgreSQL → Response</p>
              <p className='pl-4'>6. → React Query cache update → UI re-render</p>
            </div>
          </div>
        </SubSection>

        <SubSection title='Application Layers'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Layer</th><th className='px-4 py-3 text-left font-medium'>Directory</th><th className='px-4 py-3 text-left font-medium'>Purpose</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['Pages & Routes', '/app/*', 'Next.js App Router pages and API endpoints'],
                  ['UI Components', '/components/*', 'Reusable React components (37+ custom, 60+ shadcn/ui)'],
                  ['Custom Hooks', '/hooks/*', '14 custom hooks for data fetching and state'],
                  ['Utilities', '/lib/*', '51 utility files: auth, RBAC, Prisma, API client, etc.'],
                  ['Providers', '/providers/*', 'React context providers (Query, Auth, AI)'],
                  ['Database', '/prisma/*', 'Prisma schema, migrations, seed data'],
                  ['Scripts', '/scripts/*', 'Sync, backfill, migration, and deploy scripts'],
                  ['Static', '/public/*', 'Icons, logos, PWA manifest, service worker'],
                ].map(([l, d, p], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium text-gray-800 dark:text-gray-200'>{l}</td>
                    <td className='px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200'>{d}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Database Schema (Core Models)'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='~20 Sales/Insurance Models' description='Lead, KYPSubmission, PreAuthorization, HospitalSuggestion, InsuranceQuery, AdmissionRecord, DischargeSheet, PaymentInstallment, CaseStageHistory, CaseChatMessage, CallNote'>
              <p className='text-xs mt-2 text-gray-500'>Central entity: Lead (80+ fields). All downstream records linked via leadId.</p>
            </Card>
            <Card title='~20 HRMS Models' description='User, Employee, Department, AttendanceLog, LeaveRequest, LeaveBalance, LeaveTypeMaster, MonthlyPayroll, PayrollRecord, EmployeeDocument, Feedback, Warning, SupportTicket'>
              <p className='text-xs mt-2 text-gray-500'>Employee self-referencing hierarchy for manager/subordinate tree.</p>
            </Card>
            <Card title='~15 Finance Models' description='LedgerEntry, PartyMaster, HeadMaster, ProjectMaster, PaymentModeMaster, SalesEntry, Inventory models, PnLEntry, PnLCategory'>
              <p className='text-xs mt-2 text-gray-500'>Double-entry bookkeeping with full audit trail.</p>
            </Card>
            <Card title='~10 System Models' description='Notification, Task, WorkLog, MDApprovalRequest, Notice, SyncState, PushSubscription, AppSetting'>
              <p className='text-xs mt-2 text-gray-500'>Task management with ratings, warnings, and MD approval workflows.</p>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Authentication & Session Flow'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300'>
            <p>Auth is handled via encrypted session cookies (not JWT-based NextAuth).</p>
            <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
              <pre className='text-sm font-mono text-gray-800 dark:text-gray-200'>
{`Login Flow:
1. POST /api/auth/login with email + password
2. bcryptjs.compare() verifies password
3. TERMINATED/ABSCONDED employees are blocked
4. Encrypted session cookie set (httpOnly, secure)
5. Frontend reads session via GET /api/auth/me

API Guard:
1. getSession() from lib/session.ts decrypts cookie
2. hasPermission(user, 'domain:action') from lib/rbac.ts
3. Unauthorized returns 401/403`}
              </pre>
            </div>
          </div>
        </SubSection>
      </>
    )
  },
}
