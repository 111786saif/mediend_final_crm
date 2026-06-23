// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout, PipelineCard } from '../components/docs-components'

export const hrmsSections = {
  'hrms-employees': {
    title: 'Employee Management',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Employee Management module handles the full employee lifecycle: onboarding, department/team assignment, hierarchy management, status tracking, and document management. The Employee model is linked 1:1 to a User account.</p>

        <SubSection title='Employee Model'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Core Fields' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>employeeCode, bdNumber (unique identifiers)</li>
                <li>name, email, phone</li>
                <li>department, team (via DepartmentTeam)</li>
                <li>manager (self-referencing hierarchy)</li>
                <li>doj (date of joining), status</li>
              </ul>
            </Card>
            <Card title='Hierarchy' description='Self-referencing employee hierarchy'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>managerId → Employee (parent)</li>
                <li>subordinates (children via relation)</li>
                <li>Used for team pipelines, approvals, and org charts</li>
                <li>lib/hierarchy.ts: tree traversal utilities</li>
              </ul>
            </Card>
            <Card title='Statuses' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>ACTIVE — Currently employed</li>
                <li>ON_PIP — Performance improvement plan</li>
                <li>ON_NOTICE — Resignation notice period</li>
                <li>TERMINATED — Employment ended</li>
                <li>ABSCONDED — No-show (blocks login)</li>
              </ul>
            </Card>
            <Card title='Salary & FnF' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Salary linked to SalaryStructure model</li>
                <li>FnF (Full and Final) fields: fnfAmount, fnfSettledAt</li>
                <li>Documents: offer letter, increment letter, experience letter</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Department & Team Structure'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Departments have shift configuration (start hour, grace periods, penalty config). Teams within departments have team leads.</p>
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
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Attendance System integrates with biometric devices to track employee check-in/check-out. Missing punches can be normalized through a request/approval workflow.</p>

        <SubSection title='Attendance Flow'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <PipelineCard stage='1. Biometric Sync' actor='System / HR' description='Biometric punch data is synced via POST /api/attendance/sync. Creates AttendanceLog records (IN/OUT per date).' />
            <PipelineCard stage='2. Missing Punch' actor='Employee' description='Employee or Manager requests normalization for missing punches via POST /api/attendance/normalize/request.' />
            <PipelineCard stage='3. HR Approval' actor='HR' description='HR reviews and approves/rejects normalization via POST /api/attendance/normalize/[id]/approve.' />
          </div>
        </SubSection>

        <SubSection title='Attendance Configuration'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>Each department has configurable shift rules:</p>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Shift Settings (per Department)' description=''>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>shiftStartHour: When the work day starts</li>
                <li>lateGracePeriod: Minutes allowed after shift start</li>
                <li>halfDayGracePeriod: Threshold for half-day marking</li>
                <li>absentPenaltyConfig: Penalty rules for absences</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Attendance APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/attendance',description:'List attendance logs with filters'},
            {method:'GET',path:'/api/attendance/my',description:'My attendance records'},
            {method:'GET',path:'/api/attendance/stats',description:'Attendance statistics'},
            {method:'POST',path:'/api/attendance/sync',description:'Sync from biometric device'},
            {method:'POST',path:'/api/attendance/normalize/request',description:'Request attendance normalization'},
            {method:'GET',path:'/api/attendance/normalize',description:'List normalization requests'},
            {method:'POST',path:'/api/attendance/normalize/[id]/approve',description:'HR approve/reject normalization'},
          ]} />
        </SubSection>
      </>
    )
  },

  'hrms-leaves': {
    title: 'Leave Management',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Leave Management system handles leave applications, approvals, balance tracking, monthly accrual, and carry-forward rules.</p>

        <SubSection title='Leave Types'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Type</th><th className='px-4 py-3 text-left font-medium'>Accrual</th><th className='px-4 py-3 text-left font-medium'>Carry Forward</th><th className='px-4 py-3 text-left font-medium'>Probation Unlock</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['CL (Casual Leave)', 'Monthly', 'Yes (limited)', 'Yes'],
                  ['SL (Sick Leave)', 'Monthly', 'No', 'Yes'],
                  ['EL (Earned Leave)', 'Monthly', 'Yes', 'No — probation period required'],
                ].map(([t, a, c, p], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-medium'>{t}</td><td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{a}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{c}</td><td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title='Leave Flow'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>1. Apply:</strong> Employee selects leave type, dates, reason. POST /api/leaves/apply.</p>
            <p><strong>2. Auto-deduction:</strong> System deducts from LeaveBalance on submission.</p>
            <p><strong>3. Approval:</strong> Manager approves/rejects via POST /api/leaves/[id]/approve. Multi-level if configured.</p>
            <p><strong>4. Reversal:</strong> If rejected, balance is restored.</p>
          </div>
        </SubSection>

        <SubSection title='Leave Balance Management'>
          <p className='text-gray-700 dark:text-gray-300 mb-4'>HR can view and bulk-update leave balances. Balance edit requests require MD approval.</p>
          <APITable routes={[
            {method:'GET',path:'/api/leaves',description:'List leave requests with pagination'},
            {method:'GET',path:'/api/leaves/my',description:'My leave requests'},
            {method:'POST',path:'/api/leaves/apply',description:'Apply for leave'},
            {method:'POST',path:'/api/leaves/[id]/approve',description:'Approve/reject leave'},
            {method:'GET',path:'/api/leaves/types',description:'List leave types'},
            {method:'POST',path:'/api/leaves/types',description:'Create leave type'},
            {method:'GET',path:'/api/hr/leave-balances',description:'List all leave balances'},
            {method:'POST',path:'/api/hr/leave-balances/bulk',description:'Bulk update leave balances'},
          ]} />
        </SubSection>
      </>
    )
  },

  'hrms-payroll': {
    title: 'Payroll',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Monthly payslip generation from salary structure, attendance-adjusted, with EPF, ESIC, and TDS deductions. Employees can view and download payslips.</p>

        <SubSection title='Payroll Generation Flow'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>1. Salary Structure:</strong> Each employee has a SalaryStructure with components: CTC, basic, HRA, PF, TDS, etc.</p>
            <p><strong>2. Attendance Adjustment:</strong> Monthly attendance is fetched and leaves/absences adjusted against salary.</p>
            <p><strong>3. Payroll Generation:</strong> HR/Finance generates payroll batch via POST /api/finance/payroll/generate. Creates MonthlyPayroll and PayrollRecord entries.</p>
            <p><strong>4. Payslip Access:</strong> Employees view at /employee/payroll or download via GET /api/payroll/my/[id]/slip.</p>
            <p><strong>5. CSV Export:</strong> Finance exports payroll data for bank processing.</p>
          </div>
        </SubSection>

        <SubSection title='Payroll APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/payroll',description:'List payroll records'},
            {method:'POST',path:'/api/payroll',description:'Create payroll'},
            {method:'GET',path:'/api/payroll/my',description:'My payroll records'},
            {method:'GET',path:'/api/payroll/my/[id]/slip',description:'Download payslip'},
            {method:'POST',path:'/api/finance/payroll/generate',description:'Generate payroll batch'},
            {method:'GET',path:'/api/finance/payroll',description:'Finance payroll view'},
            {method:'POST',path:'/api/finance/payroll/export-csv',description:'Export payroll CSV'},
          ]} />
        </SubSection>
      </>
    )
  },

  'hrms-recruitment': {
    title: 'Recruitment',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Recruitment handles job postings, interview scheduling, and internal job postings (IJP) for employee referrals and internal mobility.</p>

        <SubSection title='Recruitment Flow'>
          <div className='space-y-3 text-gray-700 dark:text-gray-300 mb-4'>
            <p><strong>Internal Job Postings (IJP):</strong> HR creates IJP listings visible to all employees. Employees can apply or refer candidates.</p>
            <p><strong>Interviews:</strong> HR schedules interviews with candidates. Interview records include date, time, panel, status.</p>
            <p><strong>IJP Applications:</strong> Employees submit applications through the system. HR tracks and processes them.</p>
          </div>
        </SubSection>

        <SubSection title='Recruitment APIs'>
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
    title: 'Performance & Feedback',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Performance management covers salary increments, 360-degree feedback, employee warnings, and mental health check-ins with 48-hour SLA.</p>

        <SubSection title='Performance Modules'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='Increments' description='Salary increment requests with approval workflow'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>POST /api/hr/increments — Create increment record</li>
                <li>GET /api/hr/increments — List increment history</li>
                <li>Linked to IncrementRequest model</li>
              </ul>
            </Card>
            <Card title='Feedback' description='360-degree employee feedback submitted to HR'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>POST /api/hr/feedback — Submit feedback</li>
                <li>GET /api/hr/feedback — List feedback entries</li>
                <li>Anonymous option available</li>
              </ul>
            </Card>
            <Card title='Warnings' description='Employee warnings linked to tasks'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Types: REPEATED_DEADLINE_MISS, LOW_QUALITY_WORK, etc.</li>
                <li>POST /api/warnings — Issue warning</li>
                <li>GET /api/warnings — List warnings</li>
              </ul>
            </Card>
            <Card title='Mental Health' description='Support requests with 48-hour SLA'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>POST /api/hr/mental-health — Submit check-in</li>
                <li>GET /api/hr/mental-health — List check-ins</li>
                <li>Confidential: only HR head can view details</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Performance APIs'>
          <APITable routes={[
            {method:'GET',path:'/api/hr/increments',description:'List increments'},
            {method:'POST',path:'/api/hr/increments',description:'Create increment'},
            {method:'GET',path:'/api/hr/feedback',description:'List feedback'},
            {method:'POST',path:'/api/hr/feedback',description:'Submit feedback'},
            {method:'GET',path:'/api/warnings',description:'List warnings'},
            {method:'POST',path:'/api/warnings',description:'Issue warning'},
            {method:'GET',path:'/api/hr/mental-health',description:'Mental health check-ins'},
            {method:'POST',path:'/api/hr/mental-health',description:'Submit mental health check-in'},
          ]} />
        </SubSection>
      </>
    )
  },

  'hrms-documents': {
    title: 'Documents',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>HR documents management: policies, offer letters, increment letters, experience letters, and other employee documents with acknowledgment tracking.</p>

        <SubSection title='Document Types'>
          <div className='grid md:grid-cols-2 gap-4 mb-4'>
            <Card title='HR Documents' description='Company policies, notices, forms uploaded to S3'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Document categories: policy, form, letter, other</li>
                <li>Acknowledgment tracking per employee</li>
                <li>Upload via POST /api/hr/documents/upload → S3</li>
              </ul>
            </Card>
            <Card title='Employee Documents' description='Per-employee document repository'>
              <ul className='text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400'>
                <li>Offer letter, increment letter, experience letter</li>
                <li>Linked to EmployeeDocument model</li>
                <li>Employees view at /documents</li>
              </ul>
            </Card>
          </div>
        </SubSection>

        <SubSection title='Document APIs'>
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
}
