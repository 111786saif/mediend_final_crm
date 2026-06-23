// @ts-nocheck
'use client'

import { SubSection, APITable, Card, Callout, PipelineCard } from '../components/docs-components'

export const processSections = {
  'insurance-process': {
    title: 'Insurance Flow Process',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>End-to-end insurance flow from lead creation to discharge. The insurance flow is the primary path for patient cases with insurance coverage.</p>

        <div className='space-y-3 mb-6'>
          <p className='text-gray-700'><strong>1.</strong> Lead created (BD / System) — pipelineStage: SALES, caseStage: NEW_LEAD</p>
          <p className='text-gray-700'><strong>2.</strong> BD fills KYP Basic Form — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/kyp/submit</code> → KYP_BASIC_COMPLETE</p>
          <p className='text-gray-700'><strong>3.</strong> Insurance suggests hospitals + policy fields — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/kyp/pre-auth</code> → HOSPITALS_SUGGESTED, pipeline INSURANCE</p>
          <p className='text-gray-700'><strong>4.</strong> BD raises pre-auth — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/leads/:id/raise-preauth</code> → PREAUTH_RAISED</p>
          <p className='text-gray-700'><strong>5.</strong> Insurance approves/rejects — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/pre-auth/:kypSubId/approve</code> → PREAUTH_COMPLETE</p>
          <p className='text-gray-700'><strong>6.</strong> Insurance fills initiate form — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/insurance-initiate-form</code></p>
          <p className='text-gray-700'><strong>7.</strong> BD marks admitted (IPD Details) — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/leads/:id/initiate</code> → INITIATED</p>
          <p className='text-gray-700'><strong>8.</strong> BD marks IPD_DONE — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/leads/:id/ipd-mark</code> → case moves to Insurance queue</p>
          <p className='text-gray-700'><strong>9.</strong> Insurance marks discharged (date only) — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/leads/:id/mark-discharged</code> → DISCHARGED</p>
          <p className='text-gray-700'><strong>10.</strong> Insurance fills discharge sheet (finalize) — <code className='text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>POST /api/discharge-sheet</code> → PLRecord auto-created, pipeline PL</p>
        </div>

        <Callout type='warning' title='Two-step Discharge'>Step 1: Mark Discharged (date only, no PL). Step 2: Fill Sheet (finalize, creates PLRecord, moves to PL pipeline).</Callout>

        <SubSection title='Stage Transition Table'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>From</th><th className='px-4 py-3 text-left font-medium'>To</th><th className='px-4 py-3 text-left font-medium'>Trigger</th><th className='px-4 py-3 text-left font-medium'>Actor</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['NEW_LEAD', 'KYP_BASIC_COMPLETE', 'POST /api/kyp/submit', 'BD'],
                  ['KYP_BASIC_COMPLETE', 'HOSPITALS_SUGGESTED', 'POST /api/kyp/pre-auth', 'Insurance'],
                  ['HOSPITALS_SUGGESTED', 'PREAUTH_RAISED', 'POST /api/leads/:id/raise-preauth', 'BD'],
                  ['PREAUTH_RAISED', 'PREAUTH_COMPLETE', 'POST /api/pre-auth/:id/approve', 'Insurance'],
                  ['PREAUTH_COMPLETE', 'INITIATED', 'POST /api/leads/:id/initiate', 'BD'],
                  ['INITIATED', 'IPD_DONE', 'POST /api/leads/:id/ipd-mark', 'BD'],
                  ['IPD_DONE', 'DISCHARGED', 'POST /api/leads/:id/mark-discharged', 'Insurance'],
                  ['DISCHARGED', 'DISCHARGED + finalized', 'POST /api/discharge-sheet', 'Insurance'],
                  ['PREAUTH_RAISED / COMPLETE / INITIATED', 'HOSPITALS_SUGGESTED', 'POST /api/leads/:id/reset-patient', 'Insurance'],
                ].map(([f, t, tr, a], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs'>{f}</td><td className='px-4 py-3 font-mono text-xs'>{t}</td>
                    <td className='px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400'>{tr}</td><td className='px-4 py-3'>{a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },

  'cash-process': {
    title: 'Cash Flow Process',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>Cash flow is the alternate path for patients without insurance coverage. Bypasses the full pre-auth/approval process.</p>

        <div className='space-y-3 mb-6'>
          <p className='text-gray-700'><strong>1.</strong> BD switches lead to cash mode — PATCH flowType: CASH → CASH_IPD_PENDING</p>
          <p className='text-gray-700'><strong>2.</strong> BD fills IPD Cash Form (patient, treatment, surgeon, payment details) → CASH_IPD_SUBMITTED</p>
          <p className='text-gray-700'><strong>3a.</strong> Insurance approves → CASH_APPROVED</p>
          <p className='text-gray-700'><strong>3b.</strong> Insurance holds → CASH_ON_HOLD (BD can re-edit and resubmit)</p>
          <p className='text-gray-700'><strong>4.</strong> Insurance fills cash discharge form → CASH_DISCHARGED → PLRecord auto-created</p>
        </div>

        <SubSection title='Stage Transition Table'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>From</th><th className='px-4 py-3 text-left font-medium'>To</th><th className='px-4 py-3 text-left font-medium'>Trigger</th><th className='px-4 py-3 text-left font-medium'>Actor</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                <tr><td className='px-4 py-3 font-mono text-xs'>Early stage</td><td className='px-4 py-3 font-mono text-xs'>CASH_IPD_PENDING</td><td className='px-4 py-3 font-mono text-xs'>PATCH /api/leads/:id</td><td className='px-4 py-3'>BD</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>CASH_IPD_PENDING</td><td className='px-4 py-3 font-mono text-xs'>CASH_IPD_SUBMITTED</td><td className='px-4 py-3 font-mono text-xs'>IPD Cash Form submit</td><td className='px-4 py-3'>BD</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>CASH_IPD_SUBMITTED</td><td className='px-4 py-3 font-mono text-xs'>CASH_APPROVED</td><td className='px-4 py-3 font-mono text-xs'>POST /api/leads/:id/cash-review</td><td className='px-4 py-3'>Insurance</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>CASH_IPD_SUBMITTED</td><td className='px-4 py-3 font-mono text-xs'>CASH_ON_HOLD</td><td className='px-4 py-3 font-mono text-xs'>POST /api/leads/:id/cash-review</td><td className='px-4 py-3'>Insurance</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>CASH_ON_HOLD</td><td className='px-4 py-3 font-mono text-xs'>CASH_IPD_SUBMITTED</td><td className='px-4 py-3 font-mono text-xs'>BD re-edits and resubmits</td><td className='px-4 py-3'>BD</td></tr>
                <tr><td className='px-4 py-3 font-mono text-xs'>CASH_APPROVED</td><td className='px-4 py-3 font-mono text-xs'>CASH_DISCHARGED</td><td className='px-4 py-3 font-mono text-xs'>POST /api/discharge-sheet-cash</td><td className='px-4 py-3'>Insurance</td></tr>
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },

  'pl-process': {
    title: 'P&L Process',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The P&L process handles per-case profit tracking, payout statuses, and revenue splits after discharge.</p>

        <div className='space-y-3 mb-6'>
          <p className='text-gray-700'><strong>1.</strong> Discharge sheet finalized — PLRecord auto-created with payout statuses PENDING</p>
          <p className='text-gray-700'><strong>2.</strong> PL team reviews cases at /pl/dashboard — KPIs: profit, ticket sizes, pending payouts</p>
          <p className='text-gray-700'><strong>3.</strong> Edit at /pl/record/[leadId]: payout statuses, amounts, shares, profit overrides</p>
          <p className='text-gray-700'><strong>4.</strong> Profit calculation: mediendShare - costs = mediendNetProfit</p>
          <p className='text-gray-700'><strong>5.</strong> When both hospitalPayoutStatus + doctorPayoutStatus = PAID → closedAt auto-set</p>
        </div>

        <SubSection title='Profit Formula'>
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4'>
            <pre className='text-sm font-mono text-gray-800 dark:text-gray-200'>
{`hospAmount = billAmount × hospitalSharePct / 100
medAmount = billAmount × mediendSharePct / 100
costs = referralAmt + cabCharges + dcCharges + doctorCharges + implantCost
netProfit = medAmount - costs
mediendNetProfit = manual override OR netProfit
closedAt auto when both payoutStatus = PAID`}
            </pre>
          </div>
        </SubSection>
      </>
    )
  },

  'outstanding-process': {
    title: 'Outstanding Process',
    Component: () => (
      <>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>The Outstanding process tracks post-PL payments still to be collected or paid out for discharged cases.</p>

        <div className='space-y-3 mb-6'>
          <p className='text-gray-700'><strong>1.</strong> PLRecord exists with PENDING payout statuses (hospital, doctor, mediend)</p>
          <p className='text-gray-700'><strong>2.</strong> Sync: POST /api/outstanding/sync — reads PLRecord and creates/updates OutstandingCase</p>
          <p className='text-gray-700'><strong>3.</strong> Review at /outstanding/dashboard — pending amounts, aging (outstandingDays)</p>
          <p className='text-gray-700'><strong>4.</strong> Edit statuses at /outstanding/edit/[leadId] — update payouts and follow-up notes</p>
          <p className='text-gray-700'><strong>5.</strong> Update hospital/doctor/mediend payouts until all PAID</p>
        </div>

        <SubSection title='OutstandingCase Model'>
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-800'>
                <tr><th className='px-4 py-3 text-left font-medium'>Field</th><th className='px-4 py-3 text-left font-medium'>Type</th></tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {[
                  ['srNo', 'number (Excel serial)'],
                  ['month, dos (date of service)', 'date'],
                  ['status, paymentReceived', 'string / boolean'],
                  ['managerName, bdmName, patientName, treatment, hospitalName', 'text'],
                  ['billAmount, settlementAmount, cashPaidByPatient, overallAmount', 'number'],
                  ['implantCost, dciCost', 'number'],
                  ['hospitalSharePct / Amount, mediendSharePct / Amount', 'number'],
                  ['outstandingDays', 'number (calculated)'],
                  ['remarks, remark2', 'text'],
                  ['handledById', 'user reference'],
                ].map(([f, t], i) => (
                  <tr key={i} className='hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                    <td className='px-4 py-3 font-mono text-xs font-medium text-gray-800 dark:text-gray-200'>{f}</td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-400'>{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>
      </>
    )
  },
}
